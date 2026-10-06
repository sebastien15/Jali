<?php

namespace App\Modules\Bus\Infrastructure;

use App\Models\AdminStation;
use App\Models\User;
use App\Modules\Identity\Contracts\AccountClosure;

/**
 * Account deletion (Identity): a departing station agent is unassigned from
 * their terminal; the station, its routes and departures stay.
 */
class StationAgentAccountClosure implements AccountClosure
{
    public function closeAccount(User $user): void
    {
        AdminStation::where("user_id", $user->id)->update(["user_id" => null]);
    }
}
