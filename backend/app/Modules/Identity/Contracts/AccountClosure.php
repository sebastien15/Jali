<?php

namespace App\Modules\Identity\Contracts;

use App\Models\User;

/**
 * A service's part of closing a user's account (DELETE /auth/me).
 *
 * Identity calls every registered closure inside the account-deletion
 * transaction, before it anonymises the user row. Each owning service
 * deactivates or detaches what the user offers there; history (bookings,
 * rides, hires, ledger) is never deleted. Throwing rolls the whole deletion back.
 */
interface AccountClosure
{
    public function closeAccount(User $user): void;
}
