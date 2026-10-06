<?php

namespace Tests\Feature\Rides;

use App\Models\DriverPresence;
use App\Models\DriverRate;
use App\Models\Ride;
use App\Models\RideEvent;
use App\Models\Role;
use App\Models\User;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use LogicException;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

class RideLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private User $rider;
    private User $driver;

    private array $request;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->travelTo(now()->setTimezone('Africa/Kigali')->setTime(14, 0)->utc());
        $this->rider = User::create(['name' => 'Aline Mukamana', 'phone' => '+250788111111', 'fcm_token' => 'ExponentPushToken[rider]',
            'role_id' => Role::where('name', 'user')->value('id')]);
        $this->driver = $this->onlineDriver('Jean Paul Habimana', '+250788222222', 'ExponentPushToken[driver]');
        $this->request = [
            'mode' => 'pick', 'driver_id' => $this->driver->id, 'payment_method' => 'cash',
            'pickup'  => ['lat' => -1.9441, 'lng' => 30.0619, 'address' => 'KN 3 Rd, Kiyovu, Nyarugenge'],
            'dropoff' => ['lat' => -1.9500, 'lng' => 30.1250, 'address' => 'Kimironko Market, Kimironko, Gasabo'],
        ];
    }

    private function onlineDriver(string $name, string $phone, ?string $token = null): User
    {
        $driver = User::create(['name' => $name, 'phone' => $phone, 'fcm_token' => $token, 'role_id' => Role::where('name', 'driver')->value('id')]);
        $driver->driverProfile()->create(['services' => ['ride']])->forceFill(['verification_status' => 'verified'])->save();
        $vehicle = $driver->vehicles()->create(['model' => 'RAV4', 'make' => 'Toyota', 'color' => 'White', 'plate' => 'RAB ' . $driver->id . '23A',
            'class' => 'car', 'seats' => 4, 'is_active' => true, 'insurance_expiry' => now()->addYear(), 'photos' => ['front' => '/storage/f.jpg']]);
        DriverRate::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'base_fare' => 500, 'per_km' => 400, 'min_fare' => 1500]);
        DriverPresence::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'is_online' => true,
            'lat' => -1.9450, 'lng' => 30.0630, 'last_seen_at' => now(), 'online_since' => now()]);

        return $driver;
    }

    private function asRider(): void
    {
        Sanctum::actingAs($this->rider);
    }

    private function asDriver(): void
    {
        Sanctum::actingAs($this->driver);
    }

    private function requestRide(): array
    {
        $this->asRider();
        $response = $this->postJson('/api/rides', $this->request)->assertCreated();
        OpenApiContract::assertResponse($response, 'post', '/rides');

        return $response->json();
    }

    private function events(int $rideId): array
    {
        return RideEvent::where('ride_id', $rideId)->orderBy('id')->pluck('type')->all();
    }

    /** @test */
    public function full_trip_from_request_to_rating()
    {
        $ride = $this->requestRide();
        $this->assertSame('requested', $ride['status']);
        $this->assertMatchesRegularExpression('/^\d{4}$/', $ride['start_pin']);   // rider sees PIN
        $this->assertNull($ride['driver']['phone']);                              // not before accept
        $this->assertSame($ride['driver_fare'] + $ride['service_fee'], $ride['quoted_fare']);
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[driver]' && $r['title'] === 'New ride request');

        // Driver sees the request card (neighbourhood only, earnings after commission)
        $this->asDriver();
        $cards = $this->getJson('/api/driver/ride-requests')->assertOk();
        OpenApiContract::assertResponse($cards, 'get', '/driver/ride-requests');
        $cards->assertJsonPath('0.ride_id', $ride['id'])->assertJsonPath('0.pickup_area', 'Kiyovu, Nyarugenge');
        $this->assertSame($ride['driver_fare'] - (int) round($ride['driver_fare'] * 0.08), $cards->json('0.earnings'));

        $accepted = $this->postJson("/api/rides/{$ride['id']}/accept")->assertOk()->assertJsonPath('status', 'accepted');
        OpenApiContract::assertResponse($accepted, 'post', '/rides/{id}/accept');
        $this->assertNull($accepted->json('start_pin'));                          // driver never sees PIN
        $this->assertSame('+250788111111', $accepted->json('rider.phone'));

        // Rider now sees driver phone and exact position
        $this->asRider();
        $active = $this->getJson('/api/rides/active')->assertOk()->assertJsonPath('driver.phone', '+250788222222');
        OpenApiContract::assertResponse($active, 'get', '/rides/active');
        $this->assertSame(-1.945, $active->json('driver.location.lat'));
        $pin = $active->json('start_pin');

        $this->asDriver();
        OpenApiContract::assertResponse($this->postJson("/api/rides/{$ride['id']}/arrive")->assertOk(), 'post', '/rides/{id}/arrive');
        OpenApiContract::assertResponse(
            $this->postJson("/api/rides/{$ride['id']}/start", ['pin' => $pin])->assertOk()->assertJsonPath('status', 'in_progress'),
            'post', '/rides/{id}/start');

        $done = $this->postJson("/api/rides/{$ride['id']}/complete", ['payment_method' => 'momo'])->assertOk()
            ->assertJsonPath('status', 'completed')->assertJsonPath('final_fare', $ride['quoted_fare']);
        OpenApiContract::assertResponse($done, 'post', '/rides/{id}/complete');
        $this->assertSame((int) round($ride['driver_fare'] * 0.08), Ride::find($ride['id'])->commission);
        $this->assertSame(1, $this->driver->driverProfile->fresh()->trips_count);

        // Both sides rate; driver rating updates
        $this->asRider();
        OpenApiContract::assertResponse(
            $this->postJson("/api/rides/{$ride['id']}/rate", ['stars' => 4, 'tags' => ['Safe driving']])->assertCreated(),
            'post', '/rides/{id}/rate');
        $this->postJson("/api/rides/{$ride['id']}/rate", ['stars' => 5])->assertStatus(409);    // once
        $this->assertSame(4.0, $this->driver->driverProfile->fresh()->rating_avg);

        $this->asDriver();
        $this->postJson("/api/rides/{$ride['id']}/rate", ['stars' => 5])->assertCreated();

        $this->asRider();
        $history = $this->getJson('/api/rides')->assertOk()->assertJsonPath('data.0.id', $ride['id'])->assertJsonPath('data.0.my_rating', 4);
        OpenApiContract::assertResponse($history, 'get', '/rides');
        $this->assertNull($history->json('data.0.start_pin'));   // finished rides don't expose the PIN
        $none = $this->getJson('/api/rides/active')->assertOk();
        $this->assertSame('null', $none->getContent());
        OpenApiContract::assertResponse($none, 'get', '/rides/active');

        $this->assertSame(['requested', 'accepted', 'arrived', 'started', 'completed', 'rated', 'rated'], $this->events($ride['id']));
    }

    /** @test */
    public function the_price_is_locked_when_requested()
    {
        $ride = $this->requestRide();
        DriverRate::query()->update(['per_km' => 1000]);   // driver changes prices afterwards

        $this->asDriver();
        $this->postJson("/api/rides/{$ride['id']}/accept")->assertJsonPath('quoted_fare', $ride['quoted_fare']);
        $this->assertSame(400, Ride::find($ride['id'])->rate_snapshot['per_km']);
    }

    /** @test */
    public function the_client_cannot_set_the_price()
    {
        $this->asRider();
        $ride = $this->postJson('/api/rides', $this->request + ['quoted_fare' => 1, 'driver_fare' => 1])->assertCreated()->json();

        $this->assertGreaterThan(1500, $ride['quoted_fare']);
    }

    /** @test */
    public function only_one_driver_wins_and_others_get_409()
    {
        $ride = $this->requestRide();
        $other = $this->onlineDriver('Other', '+250788333333');

        Sanctum::actingAs($other);
        $this->postJson("/api/rides/{$ride['id']}/accept")->assertNotFound();   // not offered to them

        $this->asDriver();
        $this->postJson("/api/rides/{$ride['id']}/accept")->assertOk();
        $second = $this->postJson("/api/rides/{$ride['id']}/accept")->assertStatus(409);
        OpenApiContract::assertResponse($second, 'post', '/rides/{id}/accept');
    }

    /** @test */
    public function riders_cannot_hold_two_active_rides_and_busy_drivers_are_hidden()
    {
        $this->requestRide();
        $second = $this->postJson('/api/rides', $this->request)->assertStatus(409);
        OpenApiContract::assertResponse($second, 'post', '/rides');

        $otherRider = User::create(['name' => 'Bob', 'role_id' => Role::where('name', 'user')->value('id')]);
        Sanctum::actingAs($otherRider);
        $this->getJson('/api/rides/nearby?' . http_build_query(['lat' => -1.9441, 'lng' => 30.0619, 'dest_lat' => -1.95, 'dest_lng' => 30.125]))
            ->assertJsonCount(0, 'drivers');
        $this->postJson('/api/rides', $this->request)->assertStatus(409);
    }

    /** @test */
    public function offline_or_unknown_drivers_cannot_be_requested()
    {
        DriverPresence::query()->update(['last_seen_at' => now()->subMinutes(5)]);
        $this->asRider();
        $this->postJson('/api/rides', $this->request)->assertStatus(409);
        $this->postJson('/api/rides', ['driver_id' => 99999] + $this->request)->assertStatus(409);

        $response = $this->postJson('/api/rides', ['mode' => 'broadcast'] + $this->request)->assertStatus(409);   // broadcast is supported (S3.5); nobody is online nearby
        OpenApiContract::assertResponse($response, 'post', '/rides');
    }

    /** @test */
    public function decline_and_timeout_tell_the_rider_to_choose_another_driver()
    {
        $ride = $this->requestRide();
        $this->asDriver();
        OpenApiContract::assertResponse(
            $this->postJson("/api/rides/{$ride['id']}/decline")->assertOk()->assertJsonPath('status', 'declined'),
            'post', '/rides/{id}/decline');
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[rider]' && $r['title'] === 'Driver unavailable');

        // A new request can be made right away; this one times out
        $second = $this->requestRide();
        $this->travel(31)->seconds();
        $this->getJson("/api/rides/{$second['id']}")->assertJsonPath('status', 'expired');   // lazily expired

        $third = $this->requestRide();
        $this->travel(31)->seconds();
        Artisan::call('rides:expire-requests');
        $this->assertSame('expired', Ride::find($third['id'])->status);

        $this->asDriver();
        $this->postJson("/api/rides/{$third['id']}/accept")->assertStatus(409);
    }

    /** @test */
    public function start_needs_the_right_pin_and_locks_after_five_wrong_tries()
    {
        $ride = $this->requestRide();
        $this->asDriver();
        $this->postJson("/api/rides/{$ride['id']}/accept");
        $this->postJson("/api/rides/{$ride['id']}/start", ['pin' => '0000'])->assertStatus(409);   // not arrived yet
        $this->postJson("/api/rides/{$ride['id']}/arrive");

        $wrong = $ride['start_pin'] === '1111' ? '2222' : '1111';
        for ($i = 0; $i < 5; $i++) {
            $r = $this->postJson("/api/rides/{$ride['id']}/start", ['pin' => $wrong])->assertStatus(422);
        }
        OpenApiContract::assertResponse($r, 'post', '/rides/{id}/start');
        $locked = $this->postJson("/api/rides/{$ride['id']}/start", ['pin' => $ride['start_pin']])->assertStatus(423);
        OpenApiContract::assertResponse($locked, 'post', '/rides/{id}/start');
        $this->assertNotNull(Ride::find($ride['id'])->flagged_at);
        $this->assertContains('flagged', $this->events($ride['id']));
    }

    /** @test */
    public function rider_cancels_free_before_arrival_and_pays_after_the_free_wait()
    {
        $ride = $this->requestRide();
        $this->postJson("/api/rides/{$ride['id']}/cancel", ['reason' => 'nonsense'])->assertStatus(422);
        $cancelled = $this->postJson("/api/rides/{$ride['id']}/cancel", ['reason' => 'changed_plans'])->assertOk()
            ->assertJsonPath('status', 'cancelled_by_rider')->assertJsonPath('cancel_fee', 0);
        OpenApiContract::assertResponse($cancelled, 'post', '/rides/{id}/cancel');
        $this->postJson("/api/rides/{$ride['id']}/cancel", ['reason' => 'changed_plans'])->assertStatus(409);

        $ride = $this->requestRide();
        $this->asDriver();
        $this->postJson("/api/rides/{$ride['id']}/accept");
        $this->postJson("/api/rides/{$ride['id']}/arrive");
        $this->travel(6)->minutes();
        $this->asRider();
        $this->postJson("/api/rides/{$ride['id']}/cancel", ['reason' => 'found_other_transport'])->assertOk()->assertJsonPath('cancel_fee', 500);
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[driver]' && $r['title'] === 'The rider cancelled');
    }

    /** @test */
    public function driver_cancels_with_a_driver_reason()
    {
        $ride = $this->requestRide();
        $this->asDriver();
        $this->postJson("/api/rides/{$ride['id']}/cancel", ['reason' => 'traffic'])->assertStatus(409);   // can't cancel before accepting
        $this->postJson("/api/rides/{$ride['id']}/accept");
        $this->postJson("/api/rides/{$ride['id']}/cancel", ['reason' => 'changed_plans'])->assertStatus(422);
        $this->postJson("/api/rides/{$ride['id']}/cancel", ['reason' => 'vehicle_problem'])->assertOk()
            ->assertJsonPath('status', 'cancelled_by_driver');
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[rider]' && $r['title'] === 'Your driver cancelled');
    }

    /** @test */
    public function rides_are_private_to_their_rider_and_driver()
    {
        $ride = $this->requestRide();
        $stranger = User::create(['name' => 'Stranger', 'role_id' => Role::where('name', 'user')->value('id')]);
        Sanctum::actingAs($stranger);

        OpenApiContract::assertResponse($this->getJson("/api/rides/{$ride['id']}")->assertNotFound(), 'get', '/rides/{id}');
        $this->postJson("/api/rides/{$ride['id']}/cancel", ['reason' => 'changed_plans'])->assertNotFound();
        $this->postJson("/api/rides/{$ride['id']}/arrive")->assertStatus(403);   // riders can't use driver actions
        $this->assertSame('requested', Ride::find($ride['id'])->status);
    }

    /** @test */
    public function ride_events_are_append_only()
    {
        $ride = $this->requestRide();
        $event = RideEvent::where('ride_id', $ride['id'])->first();

        $this->expectException(LogicException::class);
        $event->update(['type' => 'tampered']);
    }
}
