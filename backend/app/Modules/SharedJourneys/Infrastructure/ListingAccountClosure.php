<?php

namespace App\Modules\SharedJourneys\Infrastructure;

use App\Models\PrivateSeat;
use App\Models\User;
use App\Modules\Identity\Contracts\AccountClosure;

/** Account deletion (Identity): the user's private-seat listings stop being offered; bookings stay. */
class ListingAccountClosure implements AccountClosure
{
    public function closeAccount(User $user): void
    {
        PrivateSeat::where("user_id", $user->id)->update(["active" => false]);
    }
}
