<?php

namespace Database\Seeders;

use App\Models\AdminStation;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    private ?string $password = null;

    /**
     * Initial admin password: SEED_ADMIN_PASSWORD if set; the well-known
     * dev password locally; otherwise a random one printed once, so a
     * production seed never ships with a password that is in the repo.
     */
    private function password(): string
    {
        if ($this->password === null) {
            $this->password = env("SEED_ADMIN_PASSWORD")
                ?: (app()->environment("local", "testing") ? "Jali@2026" : \Illuminate\Support\Str::password(20));
        }
        return $this->password;
    }

    public function run(): void
    {
        if (!app()->environment("local", "testing") && !env("SEED_ADMIN_PASSWORD")) {
            $this->command?->info("Initial admin password (shown once, change it after first login): " . $this->password());
        }

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
            $user = User::firstOrCreate(
                ["email" => $data["email"]],
                [
                    "name" => $data["name"],
                    "firebase_uid" => null,
                    "role_id" => $data["role"]->id,
                    "password" => bcrypt($this->password()),
                ],
            );

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
