<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Roles & Permissions (must be first)
        $this->call(RolesAndPermissionsSeeder::class);

        // 2. Users (assigns roles)
        $this->call(UsersSeeder::class);

        // 3. Admin Stations (requires users)
        $this->call(AdminStationsSeeder::class);

        // 4. Transportation data
        $this->call(BusesSeeder::class);
        $this->call(CarRentalsSeeder::class);
        $this->call(PrivateSeatsSeeder::class);

        // 5. Bookings (requires users and transportation data)
        $this->call(BookingsSeeder::class);
    }
}
