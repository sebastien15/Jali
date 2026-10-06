<?php

namespace Tests\Feature\Hire;

use App\Models\ActivityLog;
use App\Models\DriverHire;
use App\Models\DriverLedgerEntry;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Support\OpenApiContract;
use Tests\TestCase;

/** S6.6: admins search and investigate hires and correct times with a logged note. */
class AdminHireTest extends TestCase
{
    use RefreshDatabase;

    private User $customer;
    private User $driver;
    private User $ops;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->customer = $this->person('Grace Uwase', 'user', '+250788111111');
        $this->driver = $this->person('Eric Nshimiyimana', 'driver', '+250788222222');
        $this->ops = $this->person('Ops', 'admin', '+250788333333');
    }

    private function person(string $name, string $role, string $phone): User
    {
        return User::create(['name' => $name, 'phone' => $phone, 'role_id' => Role::where('name', $role)->value('id')]);
    }

    private function hire(array $overrides = []): DriverHire
    {
        $start = Carbon::parse('2026-10-14 09:00', 'Africa/Kigali')->utc();

        return DriverHire::create($overrides + [
            'customer_id' => $this->customer->id, 'driver_id' => $this->driver->id, 'status' => DriverHire::COMPLETED,
            'start_at' => $start, 'end_at' => $start->copy()->addHours(4), 'duration_type' => 'hours', 'duration_value' => 4,
            'trip_type' => 'city', 'transmission' => 'automatic', 'pickup_lat' => -1.9536, 'pickup_lng' => 30.0927,
            'pickup_address' => 'Kigali Convention Centre', 'rate_snapshot' => ['hourly_rate' => 3000, 'overtime_per_hour' => 4000],
            'driver_total' => 12000, 'service_fee' => 0, 'quoted_total' => 12000, 'commission_pct' => 10,
            'overtime_minutes' => 0, 'overtime_amount' => 0, 'final_total' => 12000, 'commission' => 1200,
            'requested_at' => $start->copy()->subDay(), 'accepted_at' => $start->copy()->subDay()->addHour(),
            'checked_in_at' => $start, 'checked_out_at' => $start->copy()->addHours(4), 'payment_method' => 'cash',
        ]);
    }

    public function test_ops_search_and_open_a_hire_with_timeline_and_quote(): void
    {
        $done = $this->hire();
        $this->hire(['status' => DriverHire::CANCELLED_BY_CUSTOMER, 'checked_in_at' => null, 'checked_out_at' => null,
            'final_total' => null, 'commission' => null, 'cancelled_at' => now(), 'cancelled_by' => 'customer']);
        Sanctum::actingAs($this->ops);

        $list = $this->getJson('/api/admin/hires')->assertOk()->assertJsonCount(2, 'data');
        OpenApiContract::assertResponse($list, 'get', '/admin/hires');
        $this->getJson('/api/admin/hires?status=completed')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $done->id);
        $this->getJson('/api/admin/hires?driver=Nshimi')->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/hires?customer=0788111111')->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/hires?from=2026-10-15')->assertJsonCount(0, 'data');

        $detail = $this->getJson("/api/admin/hires/{$done->id}")->assertOk()
            ->assertJsonPath('quote.driver_total', 12000)->assertJsonPath('quote.rate.overtime_per_hour', 4000)
            ->assertJsonPath('timeline.0.type', 'requested')->assertJsonPath('timeline.3.type', 'checked_out');
        OpenApiContract::assertResponse($detail, 'get', '/admin/hires/{id}');

        Sanctum::actingAs($this->customer);
        $this->getJson('/api/admin/hires')->assertStatus(403);
    }

    public function test_correcting_check_out_recomputes_overtime_and_commission_and_is_logged(): void
    {
        $hire = $this->hire();
        Sanctum::actingAs($this->ops);
        $late = $hire->start_at->copy()->addHours(5)->toIso8601String();   // 1 h overtime

        $res = $this->postJson("/api/admin/hires/{$hire->id}/times", ['checked_out_at' => $late, 'note' => 'Driver showed the parking receipt'])
            ->assertOk()->assertJsonPath('quote.overtime_minutes', 60)->assertJsonPath('quote.overtime_amount', 4000)
            ->assertJsonPath('quote.final_total', 16000)->assertJsonPath('quote.commission', 1600);
        OpenApiContract::assertResponse($res, 'post', '/admin/hires/{id}/times');

        $log = ActivityLog::where('action', 'hire.times_corrected')->first();
        $this->assertSame($this->ops->id, $log->admin_id);
        $this->assertSame('Driver showed the parking receipt', $log->details['note']);
        $this->assertSame(1200, $log->details['before']['commission']);
        $this->assertSame(-400, (int) DriverLedgerEntry::where('user_id', $this->driver->id)->value('balance_effect'));   // 400 more commission owed
        $this->assertContains('Driver showed the parking receipt', array_column($res->json('timeline'), 'note'));

        $this->postJson("/api/admin/hires/{$hire->id}/times", ['checked_out_at' => $hire->start_at->copy()->subHour()->toIso8601String(), 'note' => 'wrong'])
            ->assertStatus(422);
        $this->postJson("/api/admin/hires/{$hire->id}/times", ['note' => 'nothing to change'])->assertStatus(422);
        $this->postJson("/api/admin/hires/{$hire->id}/times", ['checked_in_at' => $late])->assertStatus(422)->assertJsonValidationErrors('note');
    }

    public function test_only_started_or_completed_hires_have_times_to_correct(): void
    {
        $started = $this->hire(['status' => DriverHire::STARTED, 'checked_out_at' => null, 'final_total' => null, 'commission' => null]);
        $requested = $this->hire(['status' => DriverHire::REQUESTED, 'checked_in_at' => null, 'checked_out_at' => null, 'final_total' => null, 'commission' => null]);
        Sanctum::actingAs($this->ops);

        $this->postJson("/api/admin/hires/{$started->id}/times", ['checked_in_at' => $started->start_at->copy()->addMinutes(20)->toIso8601String(), 'note' => 'Arrived late, confirmed by phone'])
            ->assertOk()->assertJsonPath('status', 'started');
        $this->postJson("/api/admin/hires/{$started->id}/times", ['checked_out_at' => now()->toIso8601String(), 'note' => 'Not finished yet'])
            ->assertStatus(422)->assertJsonValidationErrors('checked_out_at');
        $this->postJson("/api/admin/hires/{$requested->id}/times", ['checked_in_at' => now()->toIso8601String(), 'note' => 'Should not work'])
            ->assertStatus(409);
        $this->getJson('/api/admin/hires/999999')->assertNotFound();
    }
}
