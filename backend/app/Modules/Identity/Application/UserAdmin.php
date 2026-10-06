<?php

namespace App\Modules\Identity\Application;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * /admin/users (manage-users): list everyone, rename, change role. Nobody may
 * change their own role and the last superadmin cannot be demoted.
 * Input is validated by the transport.
 */
class UserAdmin
{
    public function list(): Collection
    {
        return User::with("role")
            ->orderBy("name")
            ->get()
            ->map(function ($u) {
                return [
                    "id" => $u->id,
                    "name" => $u->name,
                    "email" => $u->email,
                    "phone" => $u->phone,
                    "role" => $u->role ? $u->role->name : "user",
                ];
            });
    }

    /** @throws \Illuminate\Database\Eloquent\ModelNotFoundException */
    public function find(int|string $id): User
    {
        return User::with("role")->findOrFail($id);
    }

    /**
     * The name is saved before the role checks run (as before), so a refused
     * role change still keeps a name sent in the same request.
     *
     * @param array{name?: string, role?: string} $data
     * @throws IdentityRequestRejected
     */
    public function update(User $actor, User $user, array $data): array
    {
        if (isset($data["name"])) {
            $user->update(["name" => $data["name"]]);
        }

        if (isset($data["role"]) && $data["role"] !== $user->role?->name) {
            if ((int) $user->id === (int) $actor->id) {
                throw IdentityRequestRejected::message(422, "You cannot change your own role.");
            }
            if ($user->isSuperAdmin() && User::whereHas("role", fn ($q) => $q->where("name", "superadmin"))->count() <= 1) {
                throw IdentityRequestRejected::message(422, "Cannot demote the last superadmin.");
            }

            $role = Role::where("name", $data["role"])->first();
            if ($role) {
                $user->update(["role_id" => $role->id]);
                $user->load("role");
            }
        }

        return [
            "id" => $user->id,
            "name" => $user->name,
            "email" => $user->email,
            "role" => $user->role ? $user->role->name : "user",
        ];
    }
}
