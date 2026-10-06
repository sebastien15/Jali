<?php

namespace App\Modules\Identity\Application;

use App\Models\Role;
use App\Models\User;
use App\Modules\Identity\Contracts\AccountClosure;
use Illuminate\Support\Facades\DB;

/**
 * DELETE /auth/me. The row is anonymised rather than removed: a hard delete
 * cascaded to the user's bookings, ratings and cashouts and — for a station
 * agent — to their whole terminal with its routes and departures. Personal
 * data is wiped, every service closes its part (AccountClosure, registered by
 * the owning modules) and every token is revoked, all in one transaction.
 */
class AccountDeletion
{
    /** @param iterable<AccountClosure> $closures in registration order */
    public function __construct(private readonly iterable $closures)
    {
    }

    /** @throws IdentityRequestRejected the last superadmin cannot leave */
    public function delete(User $user): void
    {
        if ($user->isSuperAdmin() && User::whereHas("role", fn ($q) => $q->where("name", "superadmin"))->count() <= 1) {
            throw IdentityRequestRejected::message(422, "The last superadmin account cannot be deleted.");
        }

        DB::transaction(function () use ($user) {
            $user->tokens()->delete();
            foreach ($this->closures as $closure) {
                $closure->closeAccount($user);
            }

            $user->forceFill([
                "name" => "Deleted user",
                "email" => null,
                "phone" => null,
                "password" => null,
                "firebase_uid" => null,
                "fcm_token" => null,
                "profile_image_url" => null,
                "whatsapp_number" => null,
                "contract_doc_url" => null,
                "cashout_method" => null,
                "cashout_account_number" => null,
                "cashout_account_name" => null,
                "cashout_bank_name" => null,
                "role_id" => Role::where("name", "user")->value("id"),
            ])->save();
        });
    }
}
