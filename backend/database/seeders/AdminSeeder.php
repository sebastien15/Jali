<?php

namespace Database\Seeders;

use App\Models\AdminStation;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $superadminRole = Role::where("name", "superadmin")->firstOrFail();
        $adminRole = Role::where("name", "admin")->firstOrFail();

        $admins = [
            [
                "name" => "Jean Super Admin",
                "email" => "superadmin@jali.rw",
                "role" => $superadminRole,
                "station" => null,
            ],
            [
                "name" => "Marie Admin",
                "email" => "admin.kigali@jali.rw",
                "role" => $adminRole,
                "station" => "Kigali",
            ],
            [
                "name" => "Patrick Admin",
                "email" => "admin.musanze@jali.rw",
                "role" => $adminRole,
                "station" => "Musanze",
            ],
            [
                "name" => "Alice Admin",
                "email" => "admin.huye@jali.rw",
                "role" => $adminRole,
                "station" => "Huye",
            ],
        ];

        foreach ($admins as $data) {
            // firebase_uid is intentionally null — gets linked on first Firebase login
            $user = User::firstOrCreate(
                ["email" => $data["email"]],
                ["name" => $data["name"], "firebase_uid" => null],
            );

            // Attach role only if not already assigned
            if (!$user->roles()->where("name", $data["role"]->name)->exists()) {
                $user->roles()->attach($data["role"]);
            }

            // Assign station if applicable
            if ($data["station"]) {
                AdminStation::firstOrCreate(
                    ["user_id" => $user->id],
                    ["city" => $data["station"]],
                );
            }
        }
    }
}
