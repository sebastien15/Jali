<?php

namespace App\Modules\Providers\Contracts;

use App\Models\User;

/** Services a provider is verified to offer (S23.1). Owned by Providers. */
interface ProviderServices
{
    /** @return string[] driver-profile services ("ride", "hire", …) when the profile is verified; [] otherwise */
    public function verifiedServices(User $user): array;
}
