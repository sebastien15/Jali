<?php

namespace App\Modules\Identity\Application;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * /admin/roles and /admin/permissions (manage-roles). System roles are checked
 * by name in code (isAdmin(), isDriver(), seeders), so they can be neither
 * renamed nor deleted; the superadmin role cannot be edited and always holds
 * every permission. Input is validated by the transport.
 */
class RoleAdmin
{
    public const SYSTEM_ROLES = ['superadmin', 'admin', 'user', 'driver'];

    public function list(): Collection
    {
        $roles = Role::withCount(['permissions', 'users'])->get();

        return $roles->map(fn($r) => [
            'id'               => $r->id,
            'name'             => $r->name,
            'description'      => $r->description,
            'permission_count' => $r->permissions_count,
            'user_count'       => $r->users_count,
            'is_system'        => in_array($r->name, self::SYSTEM_ROLES),
        ]);
    }

    /** @throws \Illuminate\Database\Eloquent\ModelNotFoundException */
    public function find(int $id): Role
    {
        return Role::findOrFail($id);
    }

    public function create(array $data): array
    {
        $role = Role::create($data);

        return [
            'id'               => $role->id,
            'name'             => $role->name,
            'description'      => $role->description,
            'permission_count' => 0,
            'user_count'       => 0,
            'is_system'        => false,
        ];
    }

    /**
     * Checked before the request is validated (as before).
     *
     * @throws IdentityRequestRejected
     */
    public function assertEditable(Role $role): void
    {
        if ($role->name === 'superadmin') {
            throw IdentityRequestRejected::message(422, 'Cannot edit the superadmin role.');
        }
    }

    /** @throws IdentityRequestRejected */
    public function update(Role $role, array $data): array
    {
        $this->assertEditable($role);

        // Code checks system roles by name (isAdmin(), isDriver(), seeders),
        // so renaming one silently breaks every user who has it.
        if (isset($data['name']) && $data['name'] !== $role->name && in_array($role->name, self::SYSTEM_ROLES)) {
            throw IdentityRequestRejected::message(422, 'System roles cannot be renamed.');
        }

        $role->update($data);

        return ['id' => $role->id, 'name' => $role->name, 'description' => $role->description];
    }

    /** @throws IdentityRequestRejected */
    public function delete(int $id): void
    {
        $role = Role::findOrFail($id);

        if (in_array($role->name, self::SYSTEM_ROLES)) {
            throw IdentityRequestRejected::message(422, 'Cannot delete a system role.');
        }

        if (User::where('role_id', $id)->exists()) {
            throw IdentityRequestRejected::message(422, 'Cannot delete a role that has users assigned.');
        }

        $role->delete();
    }

    public function permissionsOf(int $id): Collection
    {
        $role = Role::with('permissions')->findOrFail($id);

        return $role->permissions->map(fn($p) => [
            'id'          => $p->id,
            'name'        => $p->name,
            'description' => $p->description,
            'category'    => $p->category,
        ]);
    }

    /** The superadmin role's permissions are not chosen: it always gets all of them. */
    public function alwaysHasAllPermissions(Role $role): bool
    {
        return $role->name === 'superadmin';
    }

    public function grantAllPermissions(Role $role): void
    {
        $role->permissions()->sync(Permission::pluck('id'));
    }

    /** @param int[] $permissionIds */
    public function syncPermissions(Role $role, array $permissionIds): void
    {
        $role->permissions()->sync($permissionIds);
    }

    /** Every permission, by category then name. */
    public function permissionCatalogue(): Collection
    {
        return Permission::orderBy('category')->orderBy('name')->get(['id', 'name', 'description', 'category']);
    }
}
