<?php

namespace App\Modules\Payments\Application;

use App\Models\CashoutRequest;
use App\Models\DriverHire;
use App\Models\DriverLedgerEntry;
use App\Models\DriverSettlement;
use App\Models\Ride;
use App\Models\User;
use App\Modules\Pricing\Contracts\PricingPolicy;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Driver money (stories S5.4, S7.1, S7.2; /driver/earnings, settlements, momo,
 * payouts): earnings by period across rides and hires, what the driver owes
 * Jali, MoMo settlements an admin confirms, MoMo details riders see and
 * payouts when Jali owes the driver. Input is validated by the transport.
 *
 * The MoMo number/name are payout details kept on driver_profiles; Payments
 * is their only writer.
 */
class DriverEarnings
{
    public function __construct(private readonly PricingPolicy $pricing)
    {
    }

    /** GET /driver/earnings body. Periods are Kigali today / this week / this month. */
    public function summary(User $user): array
    {
        $now = now('Africa/Kigali');
        $periods = [
            'today' => $now->copy()->startOfDay(),
            'week'  => $now->copy()->startOfWeek(),
            'month' => $now->copy()->startOfMonth(),
        ];
        $settings = $this->pricing->settings();

        return [
            'periods' => collect($periods)->map(fn (Carbon $from) => $this->period($user, $from->utc()))->all(),
            'balance' => DriverLedger::balance($user->id),
            'owed' => DriverLedger::owed($user->id),
            'max_owed' => (int) $settings['max_commission_owed'],
            'blocked' => DriverLedger::overLimit($user->id),
            'pay_to' => $settings['settlement_momo'],
            'momo' => ['number' => $user->driverProfile?->momo_number, 'name' => $user->driverProfile?->momo_name],
            'ledger' => DriverLedgerEntry::where('user_id', $user->id)->orderByDesc('id')->limit(30)->get()->map(fn ($e) => [
                'id' => $e->id, 'type' => $e->type, 'source_type' => $e->source_type, 'source_id' => $e->source_id,
                'amount' => $e->amount, 'balance_effect' => $e->balance_effect, 'balance_after' => $e->balance_after,
                'note' => $e->note, 'at' => $e->created_at?->toIso8601String(),
            ])->values(),
            'settlements' => DriverSettlement::where('user_id', $user->id)->orderByDesc('id')->limit(10)->get()->map(fn ($s) => [
                'id' => $s->id, 'amount' => $s->amount, 'reference' => $s->reference, 'status' => $s->status,
                'at' => $s->created_at?->toIso8601String(),
            ])->values(),
            'payouts' => CashoutRequest::where(['admin_id' => $user->id, 'requester_type' => 'driver'])->orderByDesc('id')->limit(10)->get()->map(fn ($c) => [
                'id' => $c->id, 'amount' => (int) $c->amount, 'status' => $c->status, 'at' => $c->created_at?->toIso8601String(),
            ])->values(),
        ];
    }

    /**
     * "I paid Jali by MoMo" — one pending settlement at a time; an admin confirms it.
     *
     * @param array{amount: int, reference: string} $data
     * @throws PaymentRequestRejected
     */
    public function settle(User $user, array $data): DriverSettlement
    {
        if (DriverSettlement::where(['user_id' => $user->id, 'status' => 'pending'])->exists()) {
            throw PaymentRequestRejected::message(409, 'You already have a settlement waiting for confirmation.');
        }

        return DriverSettlement::create(['user_id' => $user->id, 'status' => 'pending'] + $data);
    }

    /**
     * The MoMo details riders paying by MoMo see (S7.1). 403 until the user has a driver profile.
     *
     * @param array{momo_number: string, momo_name: string} $data
     */
    public function saveMomo(User $user, array $data): void
    {
        abort_unless($user->driverProfile, 403, 'Become a driver first.');
        $user->driverProfile->update($data);
    }

    /**
     * Cash out to MoMo — only up to what Jali owes the driver (in-app payments).
     *
     * @throws ValidationException
     */
    public function payout(User $user, int $amount): CashoutRequest
    {
        $profile = $user->driverProfile;
        if (!$profile?->momo_number) {
            throw ValidationException::withMessages(['amount' => 'Add your MoMo number first.']);
        }
        if ($amount > DriverLedger::balance($user->id)) {
            throw ValidationException::withMessages(['amount' => 'You can cash out at most what Jali owes you.']);
        }

        return CashoutRequest::create([
            'admin_id' => $user->id, 'requester_type' => 'driver', 'amount' => $amount, 'method' => 'mobile',
            'account_number' => $profile->momo_number, 'account_name' => $profile->momo_name, 'status' => 'pending',
        ]);
    }

    /** Trips, money collected, net earnings and commission since $from (rides + hires) */
    private function period(User $user, Carbon $from): array
    {
        $rides = Ride::where(['driver_id' => $user->id, 'status' => Ride::COMPLETED])->where('completed_at', '>=', $from)
            ->selectRaw('COUNT(*) as n, COALESCE(SUM(final_fare),0) as collected, COALESCE(SUM(driver_fare),0) as driver, COALESCE(SUM(commission),0) as commission, COALESCE(SUM(service_fee),0) as fees')
            ->first();
        $hires = DriverHire::where(['driver_id' => $user->id, 'status' => DriverHire::COMPLETED])->where('checked_out_at', '>=', $from)
            ->selectRaw('COUNT(*) as n, COALESCE(SUM(final_total),0) as collected, COALESCE(SUM(driver_total + overtime_amount),0) as driver, COALESCE(SUM(commission),0) as commission, COALESCE(SUM(service_fee),0) as fees')
            ->first();

        return [
            'trips'      => (int) $rides->n + (int) $hires->n,
            'collected'  => (int) $rides->collected + (int) $hires->collected,
            'earnings'   => (int) $rides->driver + (int) $hires->driver - (int) $rides->commission - (int) $hires->commission,
            'commission' => (int) $rides->commission + (int) $hires->commission + (int) $rides->fees + (int) $hires->fees,
        ];
    }
}
