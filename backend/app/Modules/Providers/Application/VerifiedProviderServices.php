<?php

namespace App\Modules\Providers\Application;

use App\Models\DriverProfile;
use App\Models\User;
use App\Modules\Providers\Contracts\ProviderServices;

class VerifiedProviderServices implements ProviderServices
{
    public function verifiedServices(User $user): array
    {
        $profile = $user->driverProfile;

        return $profile && $profile->verification_status === DriverProfile::STATUS_VERIFIED
            ? array_values((array) ($profile->services ?? []))
            : [];
    }
}
