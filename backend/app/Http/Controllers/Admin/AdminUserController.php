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
        $users = User::with("role")
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

        return response()->json($users);
    }

    public function update(Request $request, $id)
    {
        $user = User::with("role")->findOrFail($id);

        $data = $request->validate([
            "name" => "sometimes|string|max:100",
            "role" => "sometimes|string|exists:roles,name",
        ]);

        if (isset($data["name"])) {
            $user->update(["name" => $data["name"]]);
        }

        if (isset($data["role"]) && $data["role"] !== $user->role?->name) {
            if ((int) $user->id === (int) $request->user()->id) {
                return response()->json(["message" => "You cannot change your own role."], 422);
            }
            if ($user->isSuperAdmin() && User::whereHas("role", fn ($q) => $q->where("name", "superadmin"))->count() <= 1) {
                return response()->json(["message" => "Cannot demote the last superadmin."], 422);
            }

            $role = Role::where("name", $data["role"])->first();
            if ($role) {
                $user->update(["role_id" => $role->id]);
                $user->load("role");
            }
        }

        return response()->json([
            "id" => $user->id,
            "name" => $user->name,
            "email" => $user->email,
            "role" => $user->role ? $user->role->name : "user",
        ]);
    }
}
