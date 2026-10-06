<?php

namespace App\Modules\Providers\Contracts;

use App\Models\User;

/**
 * Can this provider go online for on-demand rides right now (story S5.1)?
 * Owned by Providers (verification, vehicle, insurance, photo, rates, debt).
 */
interface ProviderEligibility
{
    /** @return string[] machine-readable reasons; empty when the provider may go online */
    public function goOnlineBlockers(User $user): array;
}
