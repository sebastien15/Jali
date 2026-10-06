<?php

namespace Tests\Feature\Rides;

use App\Models\ActivityLog;
use App\Models\DriverPresence;
use App\Models\DriverRate;
use App\Models\Ride;
use App\Models\RideEvent;
use App\Models\Role;
use App\Models\User;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** Stories S10.1 (live operations) and S10.2 (rides list, detail, adjustments) */
class AdminRidesTest extends TestCase
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
        $this->driver = $this->onlineDriver('Jean Paul Habimana', '+250788222222');
        $this->admin = User::create(['name' => 'Ops Admin', 'email' => 'ops@jali.rw', 'role_id' => Role::where('name', 'admin')->value('id')]);
    }

    private function onlineDriver(string $name, string $phone): User
    {
        $driver = User::create(['name' => $name, 'phone' => $phone, 'role_id' => Role::where('name', 'driver')->value('id')]);
        $driver->driverProfile()->create(['services' => ['ride']])->forceFill(['verification_status' => 'verified'])->save();
        $vehicle = $driver->vehicles()->create(['model' => 'RAV4', 'make' => 'Toyota', 'color' => 'White', 'plate' => 'RAB ' . $driver->id . '23A',
            'class' => 'car', 'seats' => 4, 'is_active' => true, 'insurance_expiry' => now()->addYear()]);
        DriverRate::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'base_fare' => 500, 'per_km' => 400, 'min_fare' => 1500]);
        DriverPresence::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'is_online' => true,
            'lat' => -1.9450, 'lng' => 30.0630, 'last_seen_at' => now(), 'online_since' => now()]);

        return $driver;
    }

    private function requestRide(): int
    {
        Sanctum::actingAs($this->rider);

        return $this->postJson('/api/rides', [
            'mode' => 'pick', 'driver_id' => $this->driver->id, 'payment_method' => 'cash',
            'pickup'  => ['lat' => -1.9441, 'lng' => 30.0619, 'address' => 'KN 3 Rd, Kiyovu, Nyarugenge'],
            'dropoff' => ['lat' => -1.9500, 'lng' => 30.1250, 'address' => 'Kimironko Market, Kimironko, Gasabo'],
        ])->assertCreated()->json('id');
    }

    private function completedRide(): int
    {
        $id = $this->requestRide();
        $pin = Ride::find($id)->start_pin;
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/rides/$id/accept")->assertOk();
        $this->postJson("/api/rides/$id/arrive")->assertOk();
        $this->postJson("/api/rides/$id/start", ['pin' => $pin])->assertOk();
        $this->postJson("/api/rides/$id/complete", ['payment_method' => 'cash'])->assertOk();
        Sanctum::actingAs($this->rider);
        $this->postJson("/api/rides/$id/rate", ['stars' => 2, 'tags' => [], 'comment' => 'Drove too fast'])->assertCreated();

        return $id;
    }

    /** @test */
    public function live_view_shows_online_drivers_active_rides_and_counters()
    {
        $this->onlineDriver('Idle Driver', '+250788333333');
        $id = $this->requestRide();
        Ride::create(Ride::find($id)->replicate()->forceFill(['status' => 'expired', 'start_pin' => '1111'])->getAttributes());

        Sanctum::actingAs($this->admin);
        $live = $this->getJson('/api/admin/rides/live')->assertOk();
        OpenApiContract::assertResponse($live, 'get', '/admin/rides/live');
        $live->assertJsonPath('counters.drivers_online', 2)
            ->assertJsonPath('counters.drivers_online_by_class.car', 2)
            ->assertJsonPath('counters.rides_by_status.requested', 1)
            ->assertJsonPath('counters.expired_last_hour', 1)
            ->assertJsonPath('rides.0.id', $id)
            ->assertJsonPath('rides.0.rider.phone', '+250788111111')
            ->assertJsonCount(2, 'drivers');
    }

    /** @test */
    public function list_filters_by_status_people_dates_and_flagged()
    {
        $done = $this->completedRide();
        $open = $this->requestRide();

        Sanctum::actingAs($this->admin);
        $all = $this->getJson('/api/admin/rides')->assertOk()->assertJsonPath('data.0.id', $open)->assertJsonCount(2, 'data');
        OpenApiContract::assertResponse($all, 'get', '/admin/rides');

        $this->getJson('/api/admin/rides?status=completed')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $done);
        $this->getJson('/api/admin/rides?rider=Aline')->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/rides?driver=0788222222')->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/rides?driver=Nobody')->assertJsonCount(0, 'data');
        $this->getJson('/api/admin/rides?flagged=1')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $done);   // rated 2★
        $today = now('Africa/Kigali')->toDateString();
        $this->getJson("/api/admin/rides?from=$today&to=$today")->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/rides?to=' . now('Africa/Kigali')->subDay()->toDateString())->assertJsonCount(0, 'data');
        $this->getJson('/api/admin/rides?status=flying')->assertStatus(422);
    }

    /** @test */
    public function detail_shows_timeline_fare_breakdown_and_ratings()
    {
        $id = $this->completedRide();

        Sanctum::actingAs($this->admin);
        $detail = $this->getJson("/api/admin/rides/$id")->assertOk();
        OpenApiContract::assertResponse($detail, 'get', '/admin/rides/{id}');
        $this->assertSame(['requested', 'accepted', 'arrived', 'started', 'completed', 'rated'], array_column($detail->json('timeline'), 'type'));
        $detail->assertJsonPath('timeline.1.actor', 'Jean Paul Habimana')
            ->assertJsonPath('fare.rate.per_km', 400)
            ->assertJsonPath('ratings.0.from', 'rider')
            ->assertJsonPath('ratings.0.comment', 'Drove too fast')
            ->assertJsonPath('flagged', false);

        $this->getJson('/api/admin/rides/999999')->assertNotFound();
    }

    /** @test */
    public function admin_adjusts_a_completed_ride_with_a_note_and_it_is_logged()
    {
        $id = $this->completedRide();
        $ride = Ride::find($id);

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/admin/rides/$id/adjust", ['final_fare' => 1000])->assertStatus(422)->assertJsonValidationErrors('note');
        $this->postJson("/api/admin/rides/$id/adjust", ['note' => 'No change given'])->assertStatus(422);
        $this->postJson("/api/admin/rides/$id/adjust", ['commission' => 999999, 'note' => 'Too much'])->assertStatus(422)->assertJsonValidationErrors('commission');

        $adjusted = $this->postJson("/api/admin/rides/$id/adjust", ['final_fare' => $ride->final_fare - 500, 'commission' => 0, 'note' => 'Driver took a detour; refund 500 and waive commission'])
            ->assertOk()->assertJsonPath('fare.final_fare', $ride->final_fare - 500)->assertJsonPath('fare.commission', 0);
        OpenApiContract::assertResponse($adjusted, 'post', '/admin/rides/{id}/adjust');
        $this->assertSame('adjusted', last($adjusted->json('timeline'))['type']);
        $this->assertSame($ride->final_fare, RideEvent::where('type', 'adjusted')->first()->payload['before']['final_fare']);
        $this->assertTrue(ActivityLog::where(['action' => 'ride.adjusted', 'entity_id' => $id, 'admin_id' => $this->admin->id])->exists());

        // Driver now earns the full driver fare
        Sanctum::actingAs($this->driver);
        $this->getJson("/api/rides/$id")->assertJsonPath('driver_earnings', $ride->driver_fare);

        // Only completed rides
        $open = $this->requestRide();
        Sanctum::actingAs($this->admin);
        $conflict = $this->postJson("/api/admin/rides/$open/adjust", ['final_fare' => 100, 'note' => 'Not finished yet'])->assertStatus(409);
        OpenApiContract::assertResponse($conflict, 'post', '/admin/rides/{id}/adjust');
    }

    /** @test */
    public function riders_and_drivers_cannot_use_admin_ride_routes()
    {
        $id = $this->requestRide();
        foreach ([$this->rider, $this->driver] as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/admin/rides/live')->assertForbidden();
            $this->getJson('/api/admin/rides')->assertForbidden();
            $this->getJson("/api/admin/rides/$id")->assertForbidden();
            $this->postJson("/api/admin/rides/$id/adjust", ['final_fare' => 1, 'note' => 'sneaky change'])->assertForbidden();
        }
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/admin/rides')->assertUnauthorized();
    }
}
