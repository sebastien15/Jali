<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class UsersSeeder extends Seeder
{
    public function run(): void
    {
        $userRole = Role::where("name", "user")->first();
        $driverRole = Role::where("name", "driver")->first();

        // Regular users (passengers)
        $users = [
            // Test user
            [
                "firebase_uid" => "user_test_uid",
                "name" => "Test User",
                "email" => "user@jali.rw",
                "phone" => "+250700000000",
                "password" => bcrypt("Jali@2026"),
            ],
            [
                "firebase_uid" => "user_001_uid",
                "name" => "Emmanuel Niyonzima",
                "email" => "emmanuel@email.com",
                "phone" => "+250788111222",
            ],
            [
                "firebase_uid" => "user_002_uid",
                "name" => "Diane Ingabire",
                "email" => "diane@email.com",
                "phone" => "+250788333444",
            ],
            [
                "firebase_uid" => "user_003_uid",
                "name" => "Samuel Uwimana",
                "email" => "samuel@email.com",
                "phone" => "+250788555666",
            ],
            [
                "firebase_uid" => "user_004_uid",
                "name" => "Grace Umutoni",
                "email" => "grace@email.com",
                "phone" => "+250788777888",
            ],
            [
                "firebase_uid" => "user_005_uid",
                "name" => "David Mugabo",
                "email" => "david@email.com",
                "phone" => "+250788999000",
            ],
        ];

        foreach ($users as $userData) {
            User::firstOrCreate(
                ["email" => $userData["email"]],
                array_merge($userData, ["role_id" => $userRole->id]),
            );
        }

        // Drivers
        $drivers = [
            [
                "firebase_uid" => "driver_001_uid",
                "name" => "Joseph Ndayisaba",
                "email" => "joseph.driver@email.com",
                "phone" => "+250788112233",
            ],
            [
                "firebase_uid" => "driver_002_uid",
                "name" => "Claudine Nyiramana",
                "email" => "claudine.driver@email.com",
                "phone" => "+250788445566",
            ],
            [
                "firebase_uid" => "driver_003_uid",
                "name" => "Pierre Hakizimana",
                "email" => "pierre.driver@email.com",
                "phone" => "+250788778899",
            ],
        ];

        foreach ($drivers as $driverData) {
            User::firstOrCreate(
                ["email" => $driverData["email"]],
                array_merge($driverData, ["role_id" => $driverRole->id]),
            );
        }
    }
}
