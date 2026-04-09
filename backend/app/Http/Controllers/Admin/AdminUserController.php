<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;

class AdminUserController extends Controller
{
    public function index(Request $request)
    {
        $users = User::with('roles')->orderBy('name')->get()->map(function ($u) {
            return [
                'id'    => $u->id,
                'name'  => $u->name,
                'email' => $u->email,
                'phone' => $u->phone,
                'roles' => $u->roles->pluck('name'),
            ];
        });

        return response()->json($users);
    }

    public function update(Request $request, $id)
    {
        $user = User::with('roles')->findOrFail($id);

        $data = $request->validate([
            'name'  => 'sometimes|string|max:100',
            'roles' => 'sometimes|array',
            'roles.*' => 'string|exists:roles,name',
        ]);

        if (isset($data['name'])) {
            $user->update(['name' => $data['name']]);
        }

        if (isset($data['roles'])) {
            $roleIds = Role::whereIn('name', $data['roles'])->pluck('id');
            $user->roles()->sync($roleIds);
            $user->load('roles');
        }

        return response()->json([
            'id'    => $user->id,
            'name'  => $user->name,
            'email' => $user->email,
            'roles' => $user->roles->pluck('name'),
        ]);
    }
}
