<?php

namespace App\Modules\Providers\Infrastructure;

use App\Models\User;
use App\Modules\Identity\Contracts\AccountClosure;

/**
 * Account deletion (Identity): the driver profile (licence, ID number, MoMo
 * details, verification) is removed. Vehicles, documents and ride/hire history stay.
 */
class DriverProfileAccountClosure implements AccountClosure
{
    public function closeAccount(User $user): void
    {
        $user->driverProfile()->delete();
    }
}
