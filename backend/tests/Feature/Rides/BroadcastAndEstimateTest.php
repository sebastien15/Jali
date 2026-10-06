<?php

namespace Tests\Feature\Rides;

use App\Models\DriverPresence;
use App\Models\DriverRate;
use App\Models\Ride;
use App\Models\RideDispatch;
use App\Models\Role;
use App\Models\User;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** Stories S3.5 (send to all nearby under a max price) and S3.6 (fare estimate per class) */
class BroadcastAndEstimateTest extends TestCase
{
    use RefreshDatabase;

    private User $rider;
    private array $trip;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->travelTo(now()->setTimezone('Africa/Kigali')->setTime(14, 0)->utc());
        $this->rider = User::create(['name' => 'Aline', 'phone' => '+250788111111', 'role_id' => Role::where('name', 'user')->value('id')]);
        $this->trip = [
            'pickup'  => ['lat' => -1.9441, 'lng' => 30.0619, 'address' => 'KN 3 Rd, Kiyovu, Nyarugenge'],
            'dropoff' => ['lat' => -1.9500, 'lng' => 30.1250, 'address' => 'Kimironko Market, Kimironko, Gasabo'],
        ];
    }

    private function driver(string $name, string $class, int $perKm, float $lat = -1.9450, ?string $token = null): User
    {
        static $n = 0;
        $n++;
        $driver = User::create(['name' => $name, 'phone' => '+25078830000' . $n, 'fcm_token' => $token, 'role_id' => Role::where('name', 'driver')->value('id')]);
        $driver->driverProfile()->create(['services' => ['ride']])->forceFill(['verification_status' => 'verified'])->save();
        $vehicle = $driver->vehicles()->create(['model' => 'Car ' . $n, 'make' => 'Toyota', 'plate' => "RAB {$n}00A", 'class' => $class,
            'seats' => 4, 'is_active' => true, 'insurance_expiry' => now()->addYear()]);
        DriverRate::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'base_fare' => 500, 'per_km' => $perKm, 'min_fare' => 1000]);
        DriverPresence::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'is_online' => true,
            'lat' => $lat, 'lng' => 30.0630, 'last_seen_at' => now(), 'online_since' => now()]);

        return $driver;
    }

    /** @test */
    public function estimate_shows_a_price_range_and_eta_per_class()
    {
        $this->driver('Cheap Car', 'car', 300);
        $this->driver('Pricey Car', 'car', 900, -1.9500);
        $this->driver('Moto', 'moto', 200);

        Sanctum::actingAs($this->rider);
        $res = $this->postJson('/api/rides/estimate', $this->trip)->assertOk();
        OpenApiContract::assertResponse($res, 'post', '/rides/estimate');

        $classes = collect($res->json('classes'))->keyBy('class');
        $this->assertSame(['moto', 'car', 'comfort', 'van'], $classes->keys()->all());
        $this->assertSame(2, $classes['car']['drivers']);
        $this->assertLessThan($classes['car']['max_quote'], $classes['car']['min_quote']);
        $this->assertTrue($classes['moto']['available']);
        $this->assertFalse($classes['comfort']['available']);
        $this->assertNull($classes['van']['min_quote']);
        $this->assertGreaterThan(0, $res->json('trip.distance_km'));
    }

    /** @test */
    public function broadcast_goes_to_drivers_under_the_max_and_the_first_accept_wins_at_their_price()
    {
        $cheap = $this->driver('Cheap', 'car', 300, -1.9450, 'ExponentPushToken[cheap]');
        $mid = $this->driver('Mid', 'car', 500, -1.9455, 'ExponentPushToken[mid]');
        $this->driver('Pricey', 'car', 1200, -1.9452, 'ExponentPushToken[pricey]');

        // Max fare between mid and pricey
        Sanctum::actingAs($this->rider);
        $prices = collect($this->getJson('/api/rides/nearby?' . http_build_query([
            'lat' => -1.9441, 'lng' => 30.0619, 'dest_lat' => -1.9500, 'dest_lng' => 30.1250,
        ]))->json('drivers'))->pluck('quote', 'driver_id');
        $max = $prices[$mid->id] + 100;

        $res = $this->postJson('/api/rides', $this->trip + ['mode' => 'broadcast', 'vehicle_class' => 'car', 'max_fare' => $max])->assertCreated();
        OpenApiContract::assertResponse($res, 'post', '/rides');
        $ride = $res->json();
        $this->assertSame('broadcast', $ride['mode']);
        $this->assertNull($ride['driver']);
        $this->assertSame($max, $ride['max_fare']);
        $this->assertSame(2, RideDispatch::where('ride_id', $ride['id'])->count());   // pricey driver left out
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[mid]');
        Http::assertNotSent(fn ($r) => $r['to'] === 'ExponentPushToken[pricey]');

        // Both see the card with their own price
        Sanctum::actingAs($cheap);
        $card = $this->getJson('/api/driver/ride-requests')->assertOk()->assertJsonPath('0.broadcast', true);
        OpenApiContract::assertResponse($card, 'get', '/driver/ride-requests');

        // Mid accepts first and the ride takes Mid's price
        Sanctum::actingAs($mid);
        $won = $this->postJson("/api/rides/{$ride['id']}/accept")->assertOk()->assertJsonPath('status', 'accepted');
        OpenApiContract::assertResponse($won, 'post', '/rides/{id}/accept');
        $this->assertSame($prices[$mid->id], Ride::find($ride['id'])->quoted_fare);
        $this->assertLessThanOrEqual($max, Ride::find($ride['id'])->quoted_fare);

        // Cheap is too late: the card is gone and accepting is a 409
        Sanctum::actingAs($cheap);
        $this->getJson('/api/driver/ride-requests')->assertJsonCount(0);
        $this->postJson("/api/rides/{$ride['id']}/accept")->assertStatus(409);

        Sanctum::actingAs($this->rider);
        $this->getJson("/api/rides/{$ride['id']}")->assertJsonPath('driver.id', $mid->id)->assertJsonPath('quoted_fare', $prices[$mid->id]);
    }

    /** @test */
    public function broadcast_is_declined_only_when_every_driver_says_no_and_strangers_cannot_answer()
    {
        $a = $this->driver('A', 'car', 300);
        $b = $this->driver('B', 'car', 400);
        $stranger = $this->driver('Far', 'car', 300, -1.6);   // outside the radius

        Sanctum::actingAs($this->rider);
        $ride = $this->postJson('/api/rides', $this->trip + ['mode' => 'broadcast'])->assertCreated()->json();

        Sanctum::actingAs($stranger);
        $this->postJson("/api/rides/{$ride['id']}/accept")->assertNotFound();

        Sanctum::actingAs($a);
        $this->postJson("/api/rides/{$ride['id']}/decline")->assertOk()->assertJsonPath('status', 'requested');
        Sanctum::actingAs($b);
        $this->postJson("/api/rides/{$ride['id']}/decline")->assertOk()->assertJsonPath('status', 'declined');
    }

    /** @test */
    public function broadcast_with_a_max_below_every_price_is_refused()
    {
        $this->driver('A', 'car', 900);
        Sanctum::actingAs($this->rider);
        $this->postJson('/api/rides', $this->trip + ['mode' => 'broadcast', 'max_fare' => 600])->assertStatus(409)
            ->assertJsonPath('message', 'No driver nearby is available at or under your maximum price. Raise it or choose a driver.');
    }
}
