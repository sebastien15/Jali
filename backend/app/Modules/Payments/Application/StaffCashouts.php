<?php

namespace App\Modules\Payments\Application;

use App\Models\Booking;
use App\Models\CashoutRequest;
use App\Models\User;
use App\Modules\Payments\Contracts\StaffEarnings;
use Illuminate\Support\Collection;

/**
 * Station agents' earnings and cashout requests (/admin/cashout/**, confirm-bookings).
 * The one writer of staff cashout requests and cashout preferences.
 * Input is validated by the transport.
 */
class StaffCashouts implements StaffEarnings
{
    /** @return array<string, ?string> the saved payout method and account */
    public function preference(User $user): array
    {
        return [
            'cashout_method'         => $user->cashout_method,
            'cashout_account_number' => $user->cashout_account_number,
            'cashout_account_name'   => $user->cashout_account_name,
            'cashout_bank_name'      => $user->cashout_bank_name,
        ];
    }

    public function savePreference(User $user, array $data): void
    {
        $user->update($data);
    }

    /**
     * Checked before the amount is validated (as before).
     *
     * @throws PaymentRequestRejected
     */
    public function assertCanRequest(User $user): void
    {
        if (!$user->cashout_method || !$user->cashout_account_number) {
            throw PaymentRequestRejected::message(422, 'Set your cashout method first.');
        }
    }

    /**
     * A pending request to the saved method/account, within the available balance.
     *
     * @throws PaymentRequestRejected
     */
    public function request(User $user, mixed $amount): CashoutRequest
    {
        $this->assertCanRequest($user);

        $available = $this->availableFor($user);
        if ($amount > $available) {
            throw new PaymentRequestRejected(422, [
                'message'   => 'Amount exceeds your available balance (' . number_format($available) . ' RWF).',
                'available' => $available,
            ]);
        }

        return CashoutRequest::create([
            'admin_id'       => $user->id,
            'amount'         => $amount,
            'method'         => $user->cashout_method,
            'account_number' => $user->cashout_account_number,
            'account_name'   => $user->cashout_account_name,
            'bank_name'      => $user->cashout_bank_name,
            'status'         => 'pending',
        ]);
    }

    /** The admin's 20 most recent cashout requests. */
    public function recent(User $user): Collection
    {
        return CashoutRequest::where('admin_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();
    }

    /** 50% of the service fee on delivered bookings this admin handled. */
    public function earnedBy(User $user): float
    {
        return (float) Booking::where('confirmed_by', $user->id)
            ->where('status', 'delivered')
            ->sum('service_fee') * 0.5;
    }

    /** Earnings not already requested (pending/processing/completed requests count). */
    public function availableFor(User $user): float
    {
        $requested = (float) CashoutRequest::where('admin_id', $user->id)
            ->where('status', '!=', 'rejected')
            ->sum('amount');

        return max(0, $this->earnedBy($user) - $requested);
    }
}
