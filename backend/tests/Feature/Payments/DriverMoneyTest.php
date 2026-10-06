<?php

namespace Tests\Feature\Payments;

use App\Models\DriverLedgerEntry;
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

/** Stories S5.4 (earnings), S7.1 (cash/MoMo to driver), S7.2 (ledger & settlement) */
class DriverMoneyTest extends TestCase
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
        $this->rider = User::create(['name' => 'Aline', 'phone' => '+250788111111', 'role_id' => Role::where('name', 'user')->value('id')]);
        $this->admin = User::create(['name' => 'Ops', 'email' => 'ops@jali.rw', 'role_id' => Role::where('name', 'admin')->value('id')]);
        $this->driver = User::create(['name' => 'Jean Paul', 'phone' => '+250788222222', 'role_id' => Role::where('name', 'driver')->value('id')]);
        $this->driver->driverProfile()->create(['services' => ['ride']])->forceFill(['verification_status' => 'verified'])->save();
        $vehicle = $this->driver->vehicles()->create(['model' => 'RAV4', 'make' => 'Toyota', 'plate' => 'RAB 123A', 'class' => 'car',
            'seats' => 4, 'is_active' => true, 'insurance_expiry' => now()->addYear(), 'photos' => ['front' => '/storage/f.jpg']]);
        DriverRate::create(['user_id' => $this->driver->id, 'vehicle_id' => $vehicle->id, 'base_fare' => 500, 'per_km' => 400, 'min_fare' => 1500]);
        DriverPresence::create(['user_id' => $this->driver->id, 'vehicle_id' => $vehicle->id, 'is_online' => true,
            'lat' => -1.9450, 'lng' => 30.0630, 'last_seen_at' => now(), 'online_since' => now()]);
    }

    private function completeRide(string $payment = 'cash'): Ride
    {
        Sanctum::actingAs($this->rider);
        $id = $this->postJson('/api/rides', [
            'mode' => 'pick', 'driver_id' => $this->driver->id, 'payment_method' => $payment,
            'pickup' => ['lat' => -1.9441, 'lng' => 30.0619], 'dropoff' => ['lat' => -1.9500, 'lng' => 30.1250],
        ])->assertCreated()->json('id');
        $pin = Ride::find($id)->start_pin;
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/rides/$id/accept")->assertOk();
        $this->postJson("/api/rides/$id/arrive")->assertOk();
        $this->postJson("/api/rides/$id/start", ['pin' => $pin])->assertOk();
        $this->postJson("/api/rides/$id/complete", ['payment_method' => $payment])->assertOk();
        DriverPresence::where('user_id', $this->driver->id)->update(['last_seen_at' => now()]);

        return Ride::find($id);
    }

    /** @test */
    public function a_completed_ride_records_earning_and_what_the_driver_owes_and_totals_reconcile()
    {
        $rides = [$this->completeRide(), $this->completeRide('momo')];

        $owed = collect($rides)->sum(fn (Ride $r) => $r->commission + $r->service_fee);
        $earned = collect($rides)->sum(fn (Ride $r) => $r->driver_fare - $r->commission);
        $this->assertSame(-$owed, DriverLedgerEntry::where('user_id', $this->driver->id)->orderByDesc('id')->value('balance_after'));
        $this->assertSame(4, DriverLedgerEntry::count());

        Sanctum::actingAs($this->driver);
        $res = $this->getJson('/api/driver/earnings')->assertOk()
            ->assertJsonPath('owed', $owed)
            ->assertJsonPath('periods.today.trips', 2)
            ->assertJsonPath('periods.today.earnings', $earned)
            ->assertJsonPath('periods.week.collected', collect($rides)->sum('final_fare'))
            ->assertJsonPath('blocked', false);
        OpenApiContract::assertResponse($res, 'get', '/driver/earnings');
    }

    /** @test */
    public function rider_paying_by_momo_sees_the_drivers_momo_details_once_the_trip_started()
    {
        Sanctum::actingAs($this->driver);
        $this->putJson('/api/driver/momo', ['momo_number' => 'not a number', 'momo_name' => 'X'])->assertStatus(422);
        OpenApiContract::assertResponse($this->putJson('/api/driver/momo', ['momo_number' => '0788222222', 'momo_name' => 'Jean Paul H.'])->assertOk(),
            'put', '/driver/momo');

        $ride = $this->completeRide('momo');
        Sanctum::actingAs($this->rider);
        $this->getJson("/api/rides/{$ride->id}")->assertJsonPath('driver.momo.number', '0788222222')->assertJsonPath('driver.momo.name', 'Jean Paul H.');

        $cash = $this->completeRide('cash');
        Sanctum::actingAs($this->rider);
        $this->getJson("/api/rides/{$cash->id}")->assertJsonPath('driver.momo', null);
    }

    /** @test */
    public function drivers_over_the_limit_cannot_go_online_until_a_settlement_is_confirmed()
    {
        \App\Modules\Pricing\Application\RideSettings::update(['max_commission_owed' => 100], $this->admin);
        $this->completeRide();
        $owed = \App\Modules\Payments\Application\DriverLedger::owed($this->driver->id);

        Sanctum::actingAs($this->driver);
        $this->postJson('/api/driver/presence', ['online' => true, 'lat' => -1.945, 'lng' => 30.063])->assertOk()
            ->assertJsonPath('online', false)->assertJsonPath('blocked_reasons', ['commission_owed']);

        $settle = $this->postJson('/api/driver/settlements', ['amount' => $owed, 'reference' => 'MP123456789'])->assertCreated();
        OpenApiContract::assertResponse($settle, 'post', '/driver/settlements');
        $this->postJson('/api/driver/settlements', ['amount' => 100, 'reference' => 'MP22222'])->assertStatus(409);   // one pending at a time

        // Riders and drivers can't confirm
        $this->postJson("/api/admin/settlements/{$settle->json('id')}/confirm")->assertForbidden();

        Sanctum::actingAs($this->admin);
        $list = $this->getJson('/api/admin/settlements')->assertOk()->assertJsonPath('0.owed', $owed);
        OpenApiContract::assertResponse($list, 'get', '/admin/settlements');
        $ok = $this->postJson("/api/admin/settlements/{$settle->json('id')}/confirm")->assertOk()->assertJsonPath('owed', 0);
        OpenApiContract::assertResponse($ok, 'post', '/admin/settlements/{id}/confirm');
        $this->postJson("/api/admin/settlements/{$settle->json('id')}/confirm")->assertStatus(409);

        Sanctum::actingAs($this->driver);
        $this->postJson('/api/driver/presence', ['online' => true, 'lat' => -1.945, 'lng' => 30.063])->assertOk()
            ->assertJsonPath('online', true);
    }

    /** @test */
    public function rejected_settlements_change_nothing_and_payouts_need_a_positive_balance()
    {
        $this->completeRide();
        Sanctum::actingAs($this->driver);
        $id = $this->postJson('/api/driver/settlements', ['amount' => 500, 'reference' => 'FAKE123'])->json('id');

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/admin/settlements/$id/reject", [])->assertStatus(422);
        $this->postJson("/api/admin/settlements/$id/reject", ['note' => 'No such MoMo transaction'])->assertOk();
        $this->assertGreaterThan(0, \App\Modules\Payments\Application\DriverLedger::owed($this->driver->id));

        Sanctum::actingAs($this->driver);
        $this->putJson('/api/driver/momo', ['momo_number' => '0788222222', 'momo_name' => 'Jean Paul'])->assertOk();
        $this->postJson('/api/driver/payouts', ['amount' => 5000])->assertStatus(422)->assertJsonValidationErrors('amount');
    }

    /** @test */
    public function lowering_the_commission_in_admin_reduces_what_the_driver_owes()
    {
        $ride = $this->completeRide();
        $before = \App\Modules\Payments\Application\DriverLedger::owed($this->driver->id);

        Sanctum::actingAs($this->admin);
        $this->postJson("/api/admin/rides/{$ride->id}/adjust", ['commission' => 0, 'note' => 'Goodwill: waive commission'])->assertOk();

        $this->assertSame($before - $ride->commission, \App\Modules\Payments\Application\DriverLedger::owed($this->driver->id));
    }
}
