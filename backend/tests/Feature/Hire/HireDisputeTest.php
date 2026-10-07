<?php

namespace Tests\Feature\Hire;

use App\Models\DriverHire;
use App\Models\HireDispute;
use App\Models\Role;
use App\Models\User;
use App\Services\PushService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** S6.5: late cancel, no-shows on both sides, and disputes of recorded hours. */
class HireDisputeTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private User $driver;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->travelTo(Carbon::parse('2026-10-14 08:00', 'Africa/Kigali')->utc());
        $this->customer = $this->person('Grace Uwase', 'user', '+250788111111', 'ExponentPushToken[customer]');
        $this->driver = $this->person('Eric Nshimiyimana', 'driver', '+250788222222', 'ExponentPushToken[driver]');
    }

    private function person(string $name, string $role, string $phone, ?string $token = null): User
    {
        return User::create(['name' => $name, 'phone' => $phone, 'fcm_token' => $token, 'role_id' => Role::where('name', $role)->value('id')]);
    }

    /** Accepted hire starting at 09:00 Kigali, 4 h, driver price 12 000 */
    private function hire(array $overrides = []): DriverHire
    {
        $start = Carbon::parse('2026-10-14 09:00', 'Africa/Kigali')->utc();

        return DriverHire::create($overrides + [
            'customer_id' => $this->customer->id, 'driver_id' => $this->driver->id, 'status' => DriverHire::ACCEPTED,
            'start_at' => $start, 'end_at' => $start->copy()->addHours(4), 'duration_type' => 'hours', 'duration_value' => 4,
            'trip_type' => 'city', 'transmission' => 'automatic', 'pickup_lat' => -1.9536, 'pickup_lng' => 30.0927,
            'rate_snapshot' => ['hourly_rate' => 3000, 'overtime_per_hour' => 4000], 'driver_total' => 12000, 'service_fee' => 0,
            'quoted_total' => 12000, 'commission_pct' => 0, 'requested_at' => now()->subDay(), 'accepted_at' => now()->subDay(),
        ]);
    }

    public function test_late_cancel_costs_the_providers_late_fee(): void
    {
        $hire = $this->hire();   // 1 h before the start: inside the 3 h window
        Sanctum::actingAs($this->customer);
        $this->getJson("/api/driver-hire/{$hire->id}")->assertJsonPath('cancel_fee_now', 2400);   // 20 % of 12 000
        $this->postJson("/api/driver-hire/{$hire->id}/cancel", ['reason' => 'changed_plans'])->assertOk()
            ->assertJsonPath('status', 'cancelled_by_customer')->assertJsonPath('cancel_fee', 2400);
    }

    public function test_customer_reports_the_driver_did_not_come(): void
    {
        $hire = $this->hire();
        Sanctum::actingAs($this->customer);
        $this->getJson("/api/driver-hire/{$hire->id}")->assertJsonPath('no_show_from', Carbon::parse('2026-10-14 09:30', 'Africa/Kigali')->utc()->toIso8601String());

        $this->travelTo(Carbon::parse('2026-10-14 09:20', 'Africa/Kigali')->utc());
        $this->postJson("/api/driver-hire/{$hire->id}/no-show")->assertStatus(409);   // still within the grace

        $this->travelTo(Carbon::parse('2026-10-14 09:31', 'Africa/Kigali')->utc());
        $res = $this->postJson("/api/driver-hire/{$hire->id}/no-show")->assertOk()
            ->assertJsonPath('status', 'no_show_driver')->assertJsonPath('cancel_fee', 0)->assertJsonPath('no_show_from', null);
        OpenApiContract::assertResponse($res, 'post', '/driver-hire/{id}/no-show');
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[driver]' && $r['title'] === 'No-show reported');
        $this->postJson("/api/driver-hire/{$hire->id}/no-show")->assertStatus(409);   // already ended

        Sanctum::actingAs($this->person('Nosy', 'user', '+250788999999'));
        $this->postJson("/api/driver-hire/{$hire->id}/no-show")->assertNotFound();
    }

    public function test_driver_reports_the_customer_did_not_show(): void
    {
        $hire = $this->hire();
        $this->travelTo(Carbon::parse('2026-10-14 09:45', 'Africa/Kigali')->utc());
        Sanctum::actingAs($this->driver);
        $this->postJson("/api/driver-hire/{$hire->id}/no-show")->assertOk()
            ->assertJsonPath('status', 'no_show_customer')->assertJsonPath('cancel_fee', 2400);
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[customer]' && str_contains($r['body'], '2,400 RWF'));
    }

    public function test_either_side_disputes_hours_and_admins_resolve(): void
    {
        $start = Carbon::parse('2026-10-13 09:00', 'Africa/Kigali')->utc();
        $hire = $this->hire(['status' => DriverHire::COMPLETED, 'start_at' => $start, 'end_at' => $start->copy()->addHours(4),
            'checked_in_at' => $start, 'checked_out_at' => $start->copy()->addHours(6), 'overtime_minutes' => 120,
            'overtime_amount' => 8000, 'final_total' => 20000, 'commission' => 0]);

        Sanctum::actingAs($this->customer);
        $this->getJson("/api/driver-hire/{$hire->id}")->assertJsonPath('can_dispute', true);
        $this->postJson("/api/driver-hire/{$hire->id}/dispute", ['reason' => 'short'])->assertStatus(422);
        $res = $this->postJson("/api/driver-hire/{$hire->id}/dispute", ['reason' => 'We finished at 13:30, not 15:00 — no overtime.', 'claimed_end' => '13:30'])
            ->assertCreated()->assertJsonPath('can_dispute', false)->assertJsonPath('my_dispute.status', 'open');
        OpenApiContract::assertResponse($res, 'post', '/driver-hire/{id}/dispute');
        $this->postJson("/api/driver-hire/{$hire->id}/dispute", ['reason' => 'Again the same complaint'])->assertStatus(409);

        Sanctum::actingAs($this->driver);
        $this->postJson("/api/driver-hire/{$hire->id}/dispute", ['reason' => 'The customer kept me until 15:00.'])->assertCreated();

        $ops = $this->person('Ops', 'admin', '+250788333333');
        Sanctum::actingAs($ops);
        $this->getJson('/api/admin/hires?disputed=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.open_disputes', 2);
        $detail = $this->getJson("/api/admin/hires/{$hire->id}")->assertOk()->assertJsonCount(2, 'disputes')
            ->assertJsonPath('disputes.0.claimed_end', '13:30');
        $this->assertContains('disputed', array_column($detail->json('timeline'), 'type'));

        $first = $detail->json('disputes.0.id');
        $resolved = $this->postJson("/api/admin/hires/{$hire->id}/disputes/$first/resolve", ['resolution' => 'GPS shows the car parked at 13:35; overtime removed.'])
            ->assertOk()->assertJsonPath('disputes.0.status', 'resolved')->assertJsonPath('disputes.0.resolved_by', 'Ops');
        OpenApiContract::assertResponse($resolved, 'post', '/admin/hires/{id}/disputes/{disputeId}/resolve');
        $this->postJson("/api/admin/hires/{$hire->id}/disputes/$first/resolve", ['resolution' => 'again please'])->assertStatus(409);
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[customer]' && $r['title'] === 'Hire dispute resolved');
        Http::assertSent(fn ($r) => $r['to'] === 'ExponentPushToken[driver]' && $r['title'] === 'Hire dispute resolved');

        Sanctum::actingAs($this->customer);
        $this->getJson("/api/driver-hire/{$hire->id}")->assertJsonPath('my_dispute.status', 'resolved')
            ->assertJsonPath('can_dispute', true);   // may raise a new one within the window
        $this->assertSame(1, HireDispute::where('status', 'open')->count());

        $this->travelTo(now()->addDays(8));
        $this->getJson("/api/driver-hire/{$hire->id}")->assertJsonPath('can_dispute', false);
    }
}
