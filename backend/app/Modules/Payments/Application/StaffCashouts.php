<?php

namespace App\Modules\Payments\Application;

use App\Models\Booking;
use App\Models\CashoutRequest;
use App\Models\User;
use App\Modules\Payments\Contracts\StaffEarnings;

/**
 * Station agents' earnings and cashout requests (/admin/cashout/**).
 * The one writer of staff cashout requests and preferences.
 */
class StaffCashouts implements StaffEarnings
{
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
