<?php

namespace App\Modules\Rentals\Infrastructure;

use App\Models\CarRental;
use App\Models\User;
use App\Modules\Identity\Contracts\AccountClosure;

/** Account deletion (Identity): the user's rental cars stop being offered; bookings stay. */
class RentalCarAccountClosure implements AccountClosure
{
    public function closeAccount(User $user): void
    {
        CarRental::where("user_id", $user->id)->update(["active" => false]);
    }
}
