<?php

namespace App\Modules\Identity\Contracts;

use App\Models\User;

/** Role changes other modules may ask Identity for (users.role_id is owned by Identity). */
interface ProviderRoles
{
    /**
     * A newly verified provider: riders (or users without a role) become
     * `driver`; staff and existing drivers keep their role.
     */
    public function promoteVerifiedProvider(User $user): void;
}
