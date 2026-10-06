<?php

namespace Tests\Feature\Rides;

use App\Models\ActivityLog;
use App\Models\DriverLedgerEntry;
use App\Models\DriverPresence;
use App\Models\DriverRate;
use App\Models\Ride;
use App\Models\RideDispatch;
use App\Models\RideEvent;
use App\Models\Role;
use App\Models\User;
use App\Services\PushService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Architecture migration M03-Rides parity: behaviour that must survive moving
 * rides into App\Modules\NearbyRides and that the older ride tests don't pin
 * down — price lock against admin changes, PIN/contact privacy per side, event
 * payloads, lazy/command expiry and presence heartbeats, and the admin
 * guardrail revalidation side effect. Written and run green against the
 * pre-move code first.
 */
class RideParityTest extends TestCase
{
    use RefreshDatabase;

    private User $rider;
    private User $driver;
    private array $trip;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->travelTo(now()->setTimezone('Africa/Kigali')->setTime(14, 0)->utc());
        $this->rider = User::create(['name' => 'Aline Mukamana', 'phone' => '+250788111111', 'fcm_token' => 'ExponentPushToken[rider]',
            'role_id' => Role::where('name', 'user')->value('id')]);
        $this->driver = $this->onlineDriver('Jean Paul Habimana', '+250788222222', 'ExponentPushToken[driver]');
        $this->trip = [
            'pickup'  => ['lat' => -1.9441, 'lng' => 30.0619, 'address' => 'KN 3 Rd, Kiyovu, Nyarugenge'],
            'dropoff' => ['lat' => -1.9500, 'lng' => 30.1250, 'address' => 'Kimironko Market, Kimironko, Gasabo'],
        ];
    }

    private function onlineDriver(string $name, string $phone, ?string $token = null, int $perKm = 400): User
    {
        $driver = User::create(['name' => $name, 'phone' => $phone, 'fcm_token' => $token, 'role_id' => Role::where('name', 'driver')->value('id')]);
        $driver->driverProfile()->create(['services' => ['ride'], 'momo_number' => '0788' . substr($phone, -6), 'momo_name' => $name])
            ->forceFill(['verification_status' => 'verified'])->save();
        $vehicle = $driver->vehicles()->create(['model' => 'RAV4', 'make' => 'Toyota', 'color' => 'White', 'plate' => 'RAB ' . $driver->id . '23A',
            'class' => 'car', 'seats' => 4, 'is_active' => true, 'insurance_expiry' => now()->addYear()]);
        DriverRate::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'base_fare' => 500, 'per_km' => $perKm, 'min_fare' => 1500]);
        DriverPresence::create(['user_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'is_online' => true,
            'lat' => -1.9450, 'lng' => 30.0630, 'last_seen_at' => now(), 'online_since' => now()]);

        return $driver;
    }

    private function superadmin(): User
    {
        return User::create(['name' => 'Admin', 'role_id' => Role::where('name', 'superadmin')->value('id')]);
    }

    private function request(array $extra = [], string $paymentMethod = 'cash'): array
    {
        Sanctum::actingAs($this->rider);

        return $this->postJson('/api/rides', $extra + ['mode' => 'pick', 'driver_id' => $this->driver->id, 'payment_method' => $paymentMethod] + $this->trip)
            ->assertCreated()->json();
    }

    private function events(int $rideId): array
    {
        return RideEvent::where('ride_id', $rideId)->orderBy('id')->get()
            ->map(fn (RideEvent $e) => [$e->type, $e->actor_id, $e->payload])->all();
    }

    /** @test */
    public function admin_price_changes_after_the_request_do_not_change_the_locked_fare_fee_or_commission()
    {
        $ride = $this->request([], 'momo');
        $this->assertEquals(8, Ride::find($ride['id'])->commission_pct);

        Sanctum::actingAs($this->superadmin());
        $this->putJson('/api/admin/settings/rides', ['commission_pct' => 20, 'service_fee' => ['type' => 'flat', 'amount' => 900]])->assertOk();

        Sanctum::actingAs($this->driver);
        $card = $this->getJson('/api/driver/ride-requests')->assertOk()->json('0');
        $this->assertSame($ride['driver_fare'] - (int) round($ride['driver_fare'] * 0.08), $card['earnings']);
        $this->postJson("/api/rides/{$ride['id']}/accept")->assertOk()
            ->assertJsonPath('quoted_fare', $ride['quoted_fare'])->assertJsonPath('service_fee', $ride['service_fee']);
        $this->postJson("/api/rides/{$ride['id']}/arrive")->assertOk();
        $this->postJson("/api/rides/{$ride['id']}/start", ['pin' => Ride::find($ride['id'])->start_pin])->assertOk();
        $done = $this->postJson("/api/rides/{$ride['id']}/complete", ['payment_method' => 'cash'])->assertOk()
            ->assertJsonPath('final_fare', $ride['quoted_fare'])->assertJsonPath('payment_method', 'cash');

        $commission = (int) round($ride['driver_fare'] * 0.08);
        $this->assertSame($ride['driver_fare'] - $commission, $done->json('driver_earnings'));
        $this->assertSame($commission, Ride::find($ride['id'])->commission);
        $owed = DriverLedgerEntry::where(['source_type' => 'ride', 'source_id' => $ride['id'], 'type' => 'commission'])->first();
        $this->assertSame($commission + $ride['service_fee'], (int) $owed->amount);
        $this->assertSame(['requested', 'accepted', 'arrived', 'started', 'completed'], array_column($this->events($ride['id']), 0));
        $this->assertSame(['final_fare' => $ride['quoted_fare'], 'payment_method' => 'cash', 'commission' => $commission],
            $this->events($ride['id'])[4][2]);
    }

    /** @test */
    public function the_pin_and_contact_details_only_reach_the_right_side_at_the_right_time()
    {
        $ride = $this->request([], 'momo');
        $pin = Ride::find($ride['id'])->start_pin;
        $this->assertSame($pin, $ride['start_pin']);
        $this->assertNull($ride['driver']['momo']);
        $this->assertNull($ride['driver']['location']);
        $this->assertNull($ride['rider']);
        $this->assertNull($ride['driver_earnings']);
        $this->assertSame('Jean H.', $ride['driver']['name']);

        // Request card: neighbourhood only, no PIN, phone or exact pickup
        Sanctum::actingAs($this->driver);
        $card = $this->getJson('/api/driver/ride-requests')->assertOk()->json('0');
        $this->assertSame(['ride_id', 'pickup_area', 'dropoff_area', 'trip_km', 'pickup_km', 'earnings', 'broadcast', 'rider_rating',
            'payment_method', 'expires_at'], array_keys($card));
        $this->assertSame('Kimironko, Gasabo', $card['dropoff_area']);

        $view = $this->postJson("/api/rides/{$ride['id']}/accept")->assertOk()->json();
        $this->assertNull($view['start_pin']);
        $this->assertSame(['name' => 'Aline M.', 'rating' => null, 'phone' => '+250788111111'], $view['rider']);
        $this->assertNull($view['driver']['phone']);   // the driver's own view never carries their phone
        $this->assertNull($view['driver']['momo']);

        $this->postJson("/api/rides/{$ride['id']}/arrive")->assertOk()->assertJsonPath('start_pin', null);
        // The PIN goes to the rider's phone only
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[rider]' && str_contains($r['body'], "Your PIN is $pin"));
        Http::assertNotSent(fn ($r) => $r['to'] === 'ExponentPushToken[driver]' && str_contains($r['body'], $pin));

        Sanctum::actingAs($this->rider);
        $this->getJson("/api/rides/{$ride['id']}")->assertJsonPath('driver.momo', null)->assertJsonPath('start_pin', $pin);

        Sanctum::actingAs($this->driver);
        $this->postJson("/api/rides/{$ride['id']}/start", ['pin' => $pin])->assertOk()->assertJsonPath('start_pin', null);

        Sanctum::actingAs($this->rider);
        $this->getJson("/api/rides/{$ride['id']}")->assertJsonPath('start_pin', $pin)
            ->assertJsonPath('driver.momo', ['number' => '0788222222', 'name' => 'Jean Paul Habimana']);

        // Cancelled rides hide the PIN and phones
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/rides/{$ride['id']}/complete", ['payment_method' => 'momo'])->assertOk();
        $second = $this->request([], 'cash');
        $this->postJson("/api/rides/{$second['id']}/cancel", ['reason' => 'changed_plans'])->assertOk()
            ->assertJsonPath('start_pin', null)->assertJsonPath('driver.phone', null)->assertJsonPath('driver.location', null);
    }

    /** @test */
    public function the_driver_sees_only_their_own_assigned_rides_and_offers()
    {
        $ride = $this->request();
        $other = $this->onlineDriver('Eric Nshuti', '+250788333333');
        Sanctum::actingAs($other);
        $this->getJson('/api/driver/ride-requests')->assertOk()->assertExactJson([]);
        $this->postJson("/api/rides/{$ride['id']}/accept")->assertNotFound();
        $this->postJson("/api/rides/{$ride['id']}/decline")->assertNotFound();
        $this->postJson("/api/rides/{$ride['id']}/arrive")->assertNotFound();
        $this->getJson("/api/rides/{$ride['id']}")->assertNotFound();
        $this->assertSame('requested', Ride::find($ride['id'])->status);
    }

    /** @test */
    public function cancel_wrong_pin_decline_and_expiry_write_their_events_with_payloads()
    {
        $ride = $this->request();
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/rides/{$ride['id']}/accept")->assertOk();
        $this->postJson("/api/rides/{$ride['id']}/arrive")->assertOk();
        $wrong = $ride['start_pin'] === '1111' ? '2222' : '1111';
        $this->postJson("/api/rides/{$ride['id']}/start", ['pin' => $wrong])->assertStatus(422)
            ->assertJsonPath('errors.pin.0', 'Wrong PIN. Ask the rider for the 4-digit PIN in their app.');
        $this->travel(6)->minutes();
        Sanctum::actingAs($this->rider);
        $this->postJson("/api/rides/{$ride['id']}/cancel", ['reason' => 'wrong_pickup'])->assertOk()->assertJsonPath('cancel_fee', 500);

        $d = $this->driver->id;
        $r = $this->rider->id;
        $this->assertSame([
            ['requested', $r, ['driver_id' => $d, 'quote' => $ride['quoted_fare']]],
            ['accepted', $d, null],
            ['arrived', $d, null],
            ['wrong_pin', $d, ['attempt' => 1]],
            ['cancelled', $r, ['by' => 'rider', 'reason' => 'wrong_pickup', 'fee' => 500]],
        ], $this->events($ride['id']));

        // Decline, then a request that expires: the system is the actor
        DriverPresence::query()->update(['last_seen_at' => now()]);
        $declined = $this->request();
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/rides/{$declined['id']}/decline")->assertOk();
        $this->assertSame(['declined', $d, null], $this->events($declined['id'])[1]);
        $this->assertSame('declined', RideDispatch::where('ride_id', $declined['id'])->value('status'));

        $late = $this->request();
        $this->travel(31)->seconds();
        Sanctum::actingAs($this->driver);
        $this->getJson('/api/driver/ride-requests')->assertOk()->assertExactJson([]);   // lazily expired, not shown
        $this->assertSame('expired', Ride::find($late['id'])->status);
        $this->assertSame(['expired', null, null], $this->events($late['id'])[1]);
        $this->assertSame('expired', RideDispatch::where('ride_id', $late['id'])->value('status'));
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[rider]' && $r['title'] === 'No answer from the driver');
    }

    /** @test */
    public function broadcast_events_and_dispatch_rows_follow_each_answer()
    {
        $second = $this->onlineDriver('Eric Nshuti', '+250788333333', null, 450);
        Sanctum::actingAs($this->rider);
        $ride = $this->postJson('/api/rides', ['mode' => 'broadcast', 'max_fare' => 100000] + $this->trip)->assertCreated()->json();
        $this->assertNull($ride['driver']);
        $this->assertSame([['requested', $this->rider->id, ['mode' => 'broadcast', 'drivers' => 2, 'max_fare' => 100000]]], $this->events($ride['id']));

        Sanctum::actingAs($second);
        $this->postJson("/api/rides/{$ride['id']}/decline")->assertOk()->assertJsonPath('status', 'requested');
        $this->postJson("/api/rides/{$ride['id']}/decline")->assertStatus(409);
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/rides/{$ride['id']}/accept")->assertOk()->assertJsonPath('driver.id', $this->driver->id);

        $this->assertSame([
            [$this->driver->id, 'accepted'], [$second->id, 'declined'],
        ], RideDispatch::where('ride_id', $ride['id'])->orderBy('driver_id')->get()->map(fn ($x) => [$x->driver_id, $x->status])->all());
        $this->assertSame(['requested', 'declined', 'accepted'], array_column($this->events($ride['id']), 0));
        $this->assertSame(['mode' => 'broadcast'], $this->events($ride['id'])[1][2]);
    }

    /** @test */
    public function expiry_commands_keep_their_output_and_only_touch_overdue_rows()
    {
        $late = $this->request();
        $this->travel(31)->seconds();
        $fresh = Ride::create(Ride::find($late['id'])->replicate()->forceFill([
            'status' => 'requested', 'expires_at' => now()->addSeconds(30), 'start_pin' => '1111',
        ])->getAttributes());

        $this->assertSame(0, Artisan::call('rides:expire-requests'));
        $this->assertSame('1 request(s) expired', trim(Artisan::output()));
        $this->assertSame('expired', Ride::find($late['id'])->status);
        $this->assertSame('requested', $fresh->fresh()->status);
        $this->assertSame('expired', RideDispatch::where('ride_id', $late['id'])->value('status'));

        // Presence: only drivers silent past presence_ttl_sec (default 60 s) go offline
        Sanctum::actingAs($this->driver);
        DriverPresence::whereKey($this->driver->id)->update(['last_seen_at' => now()->subSeconds(59)]);
        $quiet = $this->onlineDriver('Eric Nshuti', '+250788333333');
        DriverPresence::whereKey($quiet->id)->update(['last_seen_at' => now()->subSeconds(61)]);

        $this->assertSame(0, Artisan::call('rides:expire-presence'));
        $this->assertSame('1 driver(s) set offline', trim(Artisan::output()));
        $this->assertTrue(DriverPresence::find($this->driver->id)->is_online);
        $this->assertFalse(DriverPresence::find($quiet->id)->is_online);
        $this->assertNull(DriverPresence::find($quiet->id)->online_since);

        $this->postJson('/api/driver/presence', ['online' => false])->assertOk()
            ->assertJsonPath('online', false)->assertJsonPath('online_since', null);
        $this->assertNull(DriverPresence::find($this->driver->id)->online_since);
    }

    /** @test */
    public function saving_ride_settings_revalidates_rates_logs_the_flag_count_and_drops_unknown_classes()
    {
        $other = $this->onlineDriver('Eric Nshuti', '+250788333333', null, 1000);
        $admin = $this->superadmin();
        Sanctum::actingAs($admin);

        $this->putJson('/api/admin/settings/rides', ['vehicle_classes' => [
            'car'   => ['per_km_min' => 300, 'per_km_max' => 800, 'min_fare_max' => 5000],
            'truck' => ['per_km_min' => 1, 'per_km_max' => 2, 'min_fare_max' => 3],
        ]])->assertOk()->assertJsonMissingPath('vehicle_classes.truck')->assertJsonPath('vehicle_classes.car.per_km_max', 800);

        $log = ActivityLog::where('action', 'ride_settings_updated')->latest('id')->first();
        $this->assertSame(1, $log->details['drivers_flagged']);
        $this->assertSame('platform_setting', $log->entity_type);
        $this->assertNotNull($log->entity_id);
        $this->assertNotNull(DriverRate::where('user_id', $other->id)->value('out_of_band_at'));
        $this->assertNull(DriverRate::where('user_id', $this->driver->id)->value('out_of_band_at'));

        // Out-of-band drivers are not offered to riders until they fix their price
        Sanctum::actingAs($this->rider);
        $ids = array_column($this->getJson('/api/rides/nearby?lat=-1.9441&lng=30.0619&dest_lat=-1.95&dest_lng=30.125')->json('drivers'), 'driver_id');
        $this->assertSame([$this->driver->id], $ids);

        // Loosening clears the mark again
        Sanctum::actingAs($admin);
        $this->putJson('/api/admin/settings/rides', ['vehicle_classes' => ['car' => ['per_km_min' => 300, 'per_km_max' => 1200, 'min_fare_max' => 5000]]])->assertOk();
        $this->assertSame(0, ActivityLog::where('action', 'ride_settings_updated')->latest('id')->first()->details['drivers_flagged']);
        $this->assertNull(DriverRate::where('user_id', $other->id)->value('out_of_band_at'));
    }
}
