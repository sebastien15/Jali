<?php

namespace App\Modules\Identity\Application;

use App\Models\Role;
use App\Models\User;
use App\Modules\Identity\Contracts\ProviderRoles;

/** Role changes requested by other modules (driver verification). */
class RoleAssignments implements ProviderRoles
{
    public function promoteVerifiedProvider(User $user): void
    {
        // Riders become drivers; staff keep their admin role
        if (!$user->role || $user->role->name === 'user') {
            $user->update(['role_id' => Role::where('name', 'driver')->value('id')]);
        }
    }
}
