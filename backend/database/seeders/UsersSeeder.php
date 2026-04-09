<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class UsersSeeder extends Seeder
{
    public function run(): void
    {
        $userRole = Role::where('name', 'user')->first();
        $driverRole = Role::where('name', 'driver')->first();

        // Admin users are seeded separately in AdminSeeder

        // Regular users (passengers)
        $users = [
            ['firebase_uid' => 'user_001_uid', 'name' => 'Emmanuel Niyonzima', 'email' => 'emmanuel@email.com', 'phone' => '+250788111222'],
            ['firebase_uid' => 'user_002_uid', 'name' => 'Diane Ingabire', 'email' => 'diane@email.com', 'phone' => '+250788333444'],
            ['firebase_uid' => 'user_003_uid', 'name' => 'Samuel Uwimana', 'email' => 'samuel@email.com', 'phone' => '+250788555666'],
            ['firebase_uid' => 'user_004_uid', 'name' => 'Grace Umutoni', 'email' => 'grace@email.com', 'phone' => '+250788777888'],
            ['firebase_uid' => 'user_005_uid', 'name' => 'David Mugabo', 'email' => 'david@email.com', 'phone' => '+250788999000'],
        ];

        foreach ($users as $userData) {
            $user = User::create($userData);
            $user->roles()->attach($userRole);
        }

        // Drivers (also have user role so they can book)
        $drivers = [
            ['firebase_uid' => 'driver_001_uid', 'name' => 'Joseph Ndayisaba', 'email' => 'joseph.driver@email.com', 'phone' => '+250788112233'],
            ['firebase_uid' => 'driver_002_uid', 'name' => 'Claudine Nyiramana', 'email' => 'claudine.driver@email.com', 'phone' => '+250788445566'],
            ['firebase_uid' => 'driver_003_uid', 'name' => 'Pierre Hakizimana', 'email' => 'pierre.driver@email.com', 'phone' => '+250788778899'],
        ];

        foreach ($drivers as $driverData) {
            $driver = User::create($driverData);
            $driver->roles()->attach([$userRole->id, $driverRole->id]);
        }
    }
}
