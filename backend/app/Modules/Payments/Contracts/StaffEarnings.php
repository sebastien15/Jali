<?php

namespace App\Modules\Payments\Contracts;

use App\Models\User;

/**
 * What a station agent (booking-desk admin) has earned and can still cash out:
 * 50% of the service fee on delivered bookings they handled, minus cashout
 * requests that were not rejected.
 */
interface StaffEarnings
{
    public function earnedBy(User $user): float;

    public function availableFor(User $user): float;
}
