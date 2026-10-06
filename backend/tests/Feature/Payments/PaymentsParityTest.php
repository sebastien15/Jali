<?php

namespace Tests\Feature\Payments;

use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\CashoutRequest;
use App\Models\DriverSettlement;
use App\Models\User;
use App\Modules\Payments\Application\DriverLedger;
use App\Services\PushService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * M03-Remaining characterization (Payments): staff cashouts, driver
 * settlements/MoMo/payouts and admin settlement review guards.
 * Written against the pre-module controllers.
 */
class PaymentsParityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake([PushService::EXPO_ENDPOINT => Http::response(['data' => ['status' => 'ok']])]);
    }

    private function delivered(User $admin, int $fee): void
    {
        Booking::create([
            'user_id' => $this->makeUser('user')->id, 'type' => 'trip', 'reference_id' => 1, 'title' => 't', 'sub' => '',
            'price' => 5000, 'service_fee' => $fee, 'status' => 'delivered', 'payment_method' => 'Card', 'confirmed_by' => $admin->id,
        ]);
    }

    // ── Staff cashouts ───────────────────────────────────────────────────

    public function test_staff_cashout_is_forbidden_without_confirm_bookings(): void
    {
        $this->actingAsRole('driver');
        $this->getJson('/api/admin/cashout/preference')->assertForbidden();
        $this->postJson('/api/admin/cashout/preference', ['cashout_method' => 'mobile', 'cashout_account_number' => '1'])->assertForbidden();
        $this->getJson('/api/admin/cashout/requests')->assertForbidden();
        $this->postJson('/api/admin/cashout/requests', ['amount' => 1])->assertForbidden();
        $this->assertSame(0, CashoutRequest::count());
    }

    public function test_staff_cashout_preference_request_rules_and_own_list(): void
    {
        $other = $this->makeUser('admin', ['cashout_method' => 'mobile', 'cashout_account_number' => '0788']);
        CashoutRequest::create(['admin_id' => $other->id, 'amount' => 10, 'method' => 'mobile', 'account_number' => '0788', 'status' => 'pending']);
        $admin = $this->actingAsRole('admin');
        $this->delivered($admin, 1000);   // earns 500

        // No method yet: refused before the amount is even validated
        $this->postJson('/api/admin/cashout/requests', [])->assertStatus(422)->assertExactJson(['message' => 'Set your cashout method first.']);

        $this->getJson('/api/admin/cashout/preference')->assertOk()->assertExactJson([
            'cashout_method' => null, 'cashout_account_number' => null, 'cashout_account_name' => null, 'cashout_bank_name' => null,
        ]);
        $this->postJson('/api/admin/cashout/preference', ['cashout_method' => 'cash', 'cashout_account_number' => '1'])->assertStatus(422);
        $this->postJson('/api/admin/cashout/preference', ['cashout_method' => 'bank', 'cashout_account_number' => '0011', 'cashout_bank_name' => 'BK'])
            ->assertOk()->assertExactJson(['ok' => true]);
        $admin->refresh();
        Sanctum::actingAs($admin);

        $this->postJson('/api/admin/cashout/requests', ['amount' => 0])->assertStatus(422);
        $this->postJson('/api/admin/cashout/requests', ['amount' => 600])->assertStatus(422)
            ->assertExactJson(['message' => 'Amount exceeds your available balance (500 RWF).', 'available' => 500]);
        $this->postJson('/api/admin/cashout/requests', ['amount' => 200])->assertCreated()
            ->assertJsonPath('method', 'bank')->assertJsonPath('account_number', '0011')->assertJsonPath('bank_name', 'BK')->assertJsonPath('status', 'pending');
        CashoutRequest::where('admin_id', $admin->id)->update(['status' => 'rejected']);
        $this->postJson('/api/admin/cashout/requests', ['amount' => 500])->assertCreated();   // rejected requests free the balance

        $mine = $this->getJson('/api/admin/cashout/requests')->assertOk()->json();
        $this->assertCount(2, $mine);
        $this->assertSame([$admin->id], array_values(array_unique(array_column($mine, 'admin_id'))));
        $this->assertEqualsCanonicalizing([200, 500], array_map('floatval', array_column($mine, 'amount')));
    }

    // ── Driver money ─────────────────────────────────────────────────────

    public function test_driver_settlement_momo_and_payout_guards(): void
    {
        $driver = $this->actingAsRole('driver');

        $this->putJson('/api/driver/momo', ['momo_number' => '0788222222', 'momo_name' => 'Jean'])->assertForbidden();
        $this->postJson('/api/driver/settlements', ['amount' => 500, 'reference' => 'MP1'])->assertStatus(422);
        $this->postJson('/api/driver/settlements', ['amount' => 500, 'reference' => 'MP12345'])->assertCreated()
            ->assertExactJson(['id' => DriverSettlement::first()->id, 'status' => 'pending', 'message' => 'Thanks — we will confirm your payment soon.']);
        $this->postJson('/api/driver/settlements', ['amount' => 500, 'reference' => 'MP67890'])->assertStatus(409)
            ->assertExactJson(['message' => 'You already have a settlement waiting for confirmation.']);

        $this->postJson('/api/driver/payouts', ['amount' => 1000])->assertStatus(422)
            ->assertJsonValidationErrors(['amount' => 'Add your MoMo number first.']);
        $driver->driverProfile()->create(['services' => ['ride']]);
        $driver->refresh();
        Sanctum::actingAs($driver);
        $this->putJson('/api/driver/momo', ['momo_number' => 'abc', 'momo_name' => 'Jean'])->assertStatus(422);
        $this->putJson('/api/driver/momo', ['momo_number' => '0788222222', 'momo_name' => 'Jean'])->assertOk()
            ->assertExactJson(['momo' => ['number' => '0788222222', 'name' => 'Jean']]);

        app(DriverLedger::class)->adjust($driver->id, 'manual', null, 3000, 'Jali owes');
        $this->postJson('/api/driver/payouts', ['amount' => 5000])->assertStatus(422)
            ->assertJsonValidationErrors(['amount' => 'You can cash out at most what Jali owes you.']);
        $res = $this->postJson('/api/driver/payouts', ['amount' => 3000])->assertCreated();
        $payout = CashoutRequest::find($res->json('id'));
        $res->assertExactJson(['id' => $payout->id, 'status' => 'pending']);
        $this->assertSame(['driver', 'mobile', '0788222222', 'Jean'], [$payout->requester_type, $payout->method, $payout->account_number, $payout->account_name]);

        $earnings = $this->getJson('/api/driver/earnings')->assertOk()->json();
        $this->assertSame(['periods', 'balance', 'owed', 'max_owed', 'blocked', 'pay_to', 'momo', 'ledger', 'settlements', 'payouts'], array_keys($earnings));
        $this->assertSame(3000, $earnings['balance']);
        $this->assertSame(['number' => '0788222222', 'name' => 'Jean'], $earnings['momo']);
        $this->assertSame([['id' => $payout->id, 'amount' => 3000, 'status' => 'pending', 'at' => $payout->created_at->toIso8601String()]], $earnings['payouts']);
    }

    public function test_settlement_review_is_once_only_and_needs_manage_rides(): void
    {
        $driver = $this->makeUser('driver', ['fcm_token' => 'ExponentPushToken[d]']);
        app(DriverLedger::class)->adjust($driver->id, 'manual', null, -4000, 'owes');
        $a = DriverSettlement::create(['user_id' => $driver->id, 'amount' => 1500, 'reference' => 'MP1111', 'status' => 'pending']);
        $b = DriverSettlement::create(['user_id' => $driver->id, 'amount' => 900, 'reference' => 'MP2222', 'status' => 'pending']);

        $this->actingAsRole('user');
        $this->getJson('/api/admin/settlements')->assertForbidden();
        $this->postJson("/api/admin/settlements/{$a->id}/confirm")->assertForbidden();

        $admin = $this->actingAsRole('admin');   // manage-rides
        $list = $this->getJson('/api/admin/settlements')->assertOk()->json();
        $this->assertSame([$a->id, $b->id], array_column($list, 'id'));
        $this->assertSame(4000, $list[0]['owed']);
        $this->getJson('/api/admin/settlements?status=lost')->assertStatus(422);

        $this->postJson("/api/admin/settlements/{$a->id}/confirm")->assertOk()
            ->assertExactJson(['id' => $a->id, 'status' => 'confirmed', 'owed' => 2500]);
        $this->postJson("/api/admin/settlements/{$a->id}/confirm")->assertStatus(409)->assertExactJson(['message' => 'This settlement was already reviewed.']);
        $this->postJson("/api/admin/settlements/{$a->id}/reject", ['note' => 'nope'])->assertStatus(409);
        $this->assertSame(2500, DriverLedger::owed($driver->id));

        $this->postJson("/api/admin/settlements/{$b->id}/reject", ['note' => 'No such MoMo transaction'])->assertOk()
            ->assertExactJson(['id' => $b->id, 'status' => 'rejected']);
        $this->assertSame(2500, DriverLedger::owed($driver->id));
        $this->assertSame(['driver_id' => $driver->id, 'amount' => 900, 'reference' => 'MP2222', 'note' => 'No such MoMo transaction'],
            ActivityLog::where('action', 'settlement.rejected')->first()->details);
        $this->assertSame($admin->id, ActivityLog::where('action', 'settlement.confirmed')->first()->admin_id);
        $this->postJson('/api/admin/settlements/999999/confirm')->assertNotFound();
        Http::assertSentCount(2);
    }
}
