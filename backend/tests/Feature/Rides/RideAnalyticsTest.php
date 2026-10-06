<?php

namespace Tests\Feature\Rides;

use App\Models\DriverPresence;
use App\Models\DriverRate;
use App\Models\Ride;
use App\Models\Role;
use App\Models\User;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** Story S10.3 — ride analytics */
class RideAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    private User $rider;
    private User $driver;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->travelTo(now()->setTimezone('Africa/Kigali')->setTime(14, 0)->utc());
        $this->rider = User::create(['name' => 'Aline Mukamana', 'phone' => '+250788111111', 'role_id' => Role::where('name', 'user')->value('id')]);
        $this->admin = User::create(['name' => 'Ops Admin', 'email' => 'ops@jali.rw', 'role_id' => Role::where('name', 'admin')->value('id')]);

        $this->driver = User::create(['name' => 'Jean Paul Habimana', 'phone' => '+250788222222', 'role_id' => Role::where('name', 'driver')->value('id')]);
        $this->driver->driverProfile()->create(['services' => ['ride']])->forceFill(['verification_status' => 'verified'])->save();
        $vehicle = $this->driver->vehicles()->create(['model' => 'RAV4', 'make' => 'Toyota', 'color' => 'White', 'plate' => 'RAB 123A',
            'class' => 'car', 'seats' => 4, 'is_active' => true, 'insurance_expiry' => now()->addYear()]);
        DriverRate::create(['user_id' => $this->driver->id, 'vehicle_id' => $vehicle->id, 'base_fare' => 500, 'per_km' => 400, 'min_fare' => 1500]);
        DriverPresence::create(['user_id' => $this->driver->id, 'vehicle_id' => $vehicle->id, 'is_online' => true,
            'lat' => -1.9450, 'lng' => 30.0630, 'last_seen_at' => now(), 'online_since' => now()]);
    }

    /** One ride driven end to end: 6 minutes from accept to arrive, rated 5★ */
    private function completedRide(): Ride
    {
        Sanctum::actingAs($this->rider);
        $id = $this->postJson('/api/rides', [
            'mode' => 'pick', 'driver_id' => $this->driver->id, 'payment_method' => 'cash',
            'pickup'  => ['lat' => -1.9441, 'lng' => 30.0619, 'address' => 'KN 3 Rd, Kiyovu, Nyarugenge'],
            'dropoff' => ['lat' => -1.9500, 'lng' => 30.1250, 'address' => 'Kimironko Market, Kimironko, Gasabo'],
        ])->assertCreated()->json('id');
        $pin = Ride::find($id)->start_pin;

        Sanctum::actingAs($this->driver);
        $this->postJson("/api/rides/$id/accept")->assertOk();
        $this->travel(6)->minutes();
        DriverPresence::where('user_id', $this->driver->id)->update(['last_seen_at' => now()]);
        $this->postJson("/api/rides/$id/arrive")->assertOk();
        $this->postJson("/api/rides/$id/start", ['pin' => $pin])->assertOk();
        $this->postJson("/api/rides/$id/complete", ['payment_method' => 'cash'])->assertOk();
        Sanctum::actingAs($this->rider);
        $this->postJson("/api/rides/$id/rate", ['stars' => 5, 'tags' => [], 'comment' => null])->assertCreated();

        return Ride::find($id);
    }

    private function copy(Ride $ride, array $changes): Ride
    {
        return Ride::create($ride->replicate()->forceFill($changes + ['start_pin' => '1111'])->getAttributes());
    }

    /** @test */
    public function metrics_rates_fare_per_km_and_top_drivers_are_reported()
    {
        $ride = $this->completedRide();
        $this->copy($ride, []);
        $this->copy($ride, []);
        $this->copy($ride, ['status' => Ride::CANCELLED_BY_RIDER, 'final_fare' => null, 'commission' => null]);
        $this->copy($ride, ['status' => Ride::EXPIRED, 'driver_id' => null, 'accepted_at' => null, 'arrived_at' => null, 'final_fare' => null, 'commission' => null]);

        Sanctum::actingAs($this->admin);
        $res = $this->getJson('/api/analytics/rides')->assertOk();
        OpenApiContract::assertResponse($res, 'get', '/analytics/rides');

        $res->assertJsonPath('period', 'day')
            ->assertJsonPath('totals.requested', 5)
            ->assertJsonPath('totals.completed', 3)
            ->assertJsonPath('totals.cancelled_by_rider', 1)
            ->assertJsonPath('totals.expired', 1)
            ->assertJsonPath('totals.rider_cancel_rate', 0.2)
            ->assertJsonPath('totals.expired_rate', 0.2)
            ->assertJsonPath('totals.gmv', 3 * $ride->final_fare)
            ->assertJsonPath('totals.commission', 3 * $ride->commission)
            ->assertJsonPath('totals.avg_pickup_minutes', 6)
            ->assertJsonPath('fare_per_km_by_class.car', (int) round($ride->final_fare / $ride->est_distance_km))
            ->assertJsonPath('top_drivers.by_trips.0.id', $this->driver->id)
            ->assertJsonPath('top_drivers.by_trips.0.trips', 3)
            ->assertJsonPath('top_drivers.by_rating.0.rating', 5);

        // 30 daily buckets by default, today's holds every ride
        $series = $res->json('series');
        $this->assertCount(30, $series);
        $this->assertSame(now('Africa/Kigali')->toDateString(), end($series)['bucket']);
        $this->assertSame(5, end($series)['requested']);
        $this->assertSame(0, $series[0]['requested']);
    }

    /** @test */
    public function weekly_buckets_start_on_monday()
    {
        $this->completedRide();
        Sanctum::actingAs($this->admin);
        $to = now('Africa/Kigali');
        $res = $this->getJson('/api/analytics/rides?period=week&from=' . $to->copy()->subDays(20)->toDateString() . '&to=' . $to->toDateString())->assertOk();
        OpenApiContract::assertResponse($res, 'get', '/analytics/rides');

        foreach ($res->json('series') as $bucket) {
            $this->assertTrue(\Carbon\Carbon::parse($bucket['bucket'])->isMonday());
        }
        $this->assertSame($to->copy()->startOfWeek()->toDateString(), collect($res->json('series'))->last()['bucket']);
        $this->assertSame(1, collect($res->json('series'))->last()['completed']);
    }

    /** @test */
    public function range_is_validated_and_view_analytics_is_required()
    {
        Sanctum::actingAs($this->admin);
        $this->getJson('/api/analytics/rides?from=2026-01-01&to=2026-06-01')->assertStatus(422);
        $this->getJson('/api/analytics/rides?from=2026-06-02&to=2026-06-01')->assertStatus(422);
        $this->getJson('/api/analytics/rides?period=month')->assertStatus(422);

        Sanctum::actingAs($this->driver);
        $this->getJson('/api/analytics/rides')->assertForbidden();
    }
}
