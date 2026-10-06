<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Application\IdentityRequestRejected;
use App\Modules\Identity\Application\RoleAdmin;
use Illuminate\Http\Request;

/** Transport adapter for Identity (M03-Remaining): validation + HTTP shape only. */
class RolesController extends Controller
{
    public function __construct(private readonly RoleAdmin $roles)
    {
    }

    public function index()
    {
        return response()->json($this->roles->list());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'        => 'required|string|max:50|unique:roles,name',
            'description' => 'nullable|string|max:200',
        ]);

        return response()->json($this->roles->create($data), 201);
    }

    public function update(Request $request, int $id)
    {
        $role = $this->roles->find($id);

        try {
            // The superadmin role is refused before validation, as before.
            $this->roles->assertEditable($role);

            $data = $request->validate([
                'name'        => 'sometimes|string|max:50|unique:roles,name,' . $id,
                'description' => 'nullable|string|max:200',
            ]);

            return response()->json($this->roles->update($role, $data));
        } catch (IdentityRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }

    public function destroy(int $id)
    {
        try {
            $this->roles->delete($id);
        } catch (IdentityRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }

        return response()->json(['message' => 'Role deleted.']);
    }

    public function showPermissions(int $id)
    {
        return response()->json($this->roles->permissionsOf($id));
    }

    public function syncPermissions(Request $request, int $id)
    {
        $role = $this->roles->find($id);

        if ($this->roles->alwaysHasAllPermissions($role)) {
            $this->roles->grantAllPermissions($role);
            return response()->json(['message' => 'Superadmin always has all permissions.']);
        }

        $request->validate([
            'permission_ids'   => 'present|array',
            'permission_ids.*' => 'integer|exists:permissions,id',
        ]);

        $this->roles->syncPermissions($role, $request->permission_ids);

        return response()->json(['message' => 'Permissions updated.']);
    }
}
