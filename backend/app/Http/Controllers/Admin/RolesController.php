<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;

class RolesController extends Controller
{
    private const SYSTEM_ROLES = ['superadmin', 'admin', 'user', 'driver'];

    public function index()
    {
        $roles = Role::withCount(['permissions', 'users'])->get();

        return response()->json($roles->map(fn($r) => [
            'id'               => $r->id,
            'name'             => $r->name,
            'description'      => $r->description,
            'permission_count' => $r->permissions_count,
            'user_count'       => $r->users_count,
            'is_system'        => in_array($r->name, self::SYSTEM_ROLES),
        ]));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'        => 'required|string|max:50|unique:roles,name',
            'description' => 'nullable|string|max:200',
        ]);

        $role = Role::create($data);

        return response()->json([
            'id'               => $role->id,
            'name'             => $role->name,
            'description'      => $role->description,
            'permission_count' => 0,
            'user_count'       => 0,
            'is_system'        => false,
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $role = Role::findOrFail($id);

        if ($role->name === 'superadmin') {
            return response()->json(['message' => 'Cannot edit the superadmin role.'], 422);
        }

        $data = $request->validate([
            'name'        => 'sometimes|string|max:50|unique:roles,name,' . $id,
            'description' => 'nullable|string|max:200',
        ]);

        // Code checks system roles by name (isAdmin(), isDriver(), seeders),
        // so renaming one silently breaks every user who has it.
        if (isset($data['name']) && $data['name'] !== $role->name && in_array($role->name, self::SYSTEM_ROLES)) {
            return response()->json(['message' => 'System roles cannot be renamed.'], 422);
        }

        $role->update($data);

        return response()->json(['id' => $role->id, 'name' => $role->name, 'description' => $role->description]);
    }

    public function destroy(int $id)
    {
        $role = Role::findOrFail($id);

        if (in_array($role->name, self::SYSTEM_ROLES)) {
            return response()->json(['message' => 'Cannot delete a system role.'], 422);
        }

        if (User::where('role_id', $id)->exists()) {
            return response()->json(['message' => 'Cannot delete a role that has users assigned.'], 422);
        }

        $role->delete();

        return response()->json(['message' => 'Role deleted.']);
    }

    public function showPermissions(int $id)
    {
        $role = Role::with('permissions')->findOrFail($id);

        return response()->json($role->permissions->map(fn($p) => [
            'id'          => $p->id,
            'name'        => $p->name,
            'description' => $p->description,
            'category'    => $p->category,
        ]));
    }

    public function syncPermissions(Request $request, int $id)
    {
        $role = Role::findOrFail($id);

        if ($role->name === 'superadmin') {
            $role->permissions()->sync(Permission::pluck('id'));
            return response()->json(['message' => 'Superadmin always has all permissions.']);
        }

        $request->validate([
            'permission_ids'   => 'present|array',
            'permission_ids.*' => 'integer|exists:permissions,id',
        ]);

        $role->permissions()->sync($request->permission_ids);

        return response()->json(['message' => 'Permissions updated.']);
    }
}
