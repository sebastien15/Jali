<?php

namespace App\Http\Controllers;

use App\Models\CashoutRequest;
use App\Models\DriverHire;
use App\Models\DriverLedgerEntry;
use App\Models\DriverSettlement;
use App\Models\Ride;
use App\Models\User;
use App\Modules\Payments\Application\DriverLedger;
use App\Modules\Pricing\Application\RideSettings;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Driver money: earnings by period, what I owe Jali, settling by MoMo,
 * my MoMo details and payouts (stories S5.4, S7.1, S7.2). Requires offer-rides.
 */
class DriverEarningsController extends Controller
{
    /** GET /driver/earnings */
    public function show(Request $request)
    {
        $user = $request->user();
        $now = now('Africa/Kigali');
        $periods = [
            'today' => $now->copy()->startOfDay(),
            'week'  => $now->copy()->startOfWeek(),
            'month' => $now->copy()->startOfMonth(),
        ];
        $settings = RideSettings::get();

        return response()->json([
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
        ]);
    }

    /** POST /driver/settlements {amount, reference} — I paid Jali by MoMo; an admin confirms */
    public function settle(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'amount'    => 'required|integer|min:100|max:10000000',
            'reference' => 'required|string|min:4|max:100',
        ], ['reference.required' => 'Enter the MoMo transaction ID from your confirmation SMS.']);

        if (DriverSettlement::where(['user_id' => $user->id, 'status' => 'pending'])->exists()) {
            return response()->json(['message' => 'You already have a settlement waiting for confirmation.'], 409);
        }
        $settlement = DriverSettlement::create(['user_id' => $user->id, 'status' => 'pending'] + $data);

        return response()->json(['id' => $settlement->id, 'status' => $settlement->status, 'message' => 'Thanks — we will confirm your payment soon.'], 201);
    }

    /** PUT /driver/momo {momo_number, momo_name} — riders who pay by MoMo see this (S7.1) */
    public function momo(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'momo_number' => ['required', 'string', 'regex:/^\+?[0-9 ]{9,15}$/'],
            'momo_name'   => 'required|string|max:100',
        ]);
        abort_unless($user->driverProfile, 403, 'Become a driver first.');
        $user->driverProfile->update($data);

        return response()->json(['momo' => ['number' => $data['momo_number'], 'name' => $data['momo_name']]]);
    }

    /** POST /driver/payouts {amount} — only when Jali owes me (in-app payments) */
    public function payout(Request $request)
    {
        $user = $request->user();
        $data = $request->validate(['amount' => 'required|integer|min:1000']);
        $profile = $user->driverProfile;
        if (!$profile?->momo_number) {
            throw ValidationException::withMessages(['amount' => 'Add your MoMo number first.']);
        }
        if ($data['amount'] > DriverLedger::balance($user->id)) {
            throw ValidationException::withMessages(['amount' => 'You can cash out at most what Jali owes you.']);
        }

        $cashout = CashoutRequest::create([
            'admin_id' => $user->id, 'requester_type' => 'driver', 'amount' => $data['amount'], 'method' => 'mobile',
            'account_number' => $profile->momo_number, 'account_name' => $profile->momo_name, 'status' => 'pending',
        ]);

        return response()->json(['id' => $cashout->id, 'status' => 'pending'], 201);
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
