<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Roles & Permissions (must be first)
        $this->call(RolesAndPermissionsSeeder::class);

        // 2. Admin users (must be before AdminStationsSeeder)
        $this->call(AdminSeeder::class);

        // 3. Regular users (assigns roles)
        $this->call(UsersSeeder::class);

        // 5. Admin Stations (AdminSeeder already creates stations for seeded admins)
        $this->call(AdminStationsSeeder::class);

        // 6. Transportation data
        $this->call(BusesSeeder::class);
        $this->call(CarRentalsSeeder::class);
        $this->call(PrivateSeatsSeeder::class);

        // 7. Agencies & Trips
        $this->call(AgenciesTripsSeeder::class);

        // 8. Bookings (requires users and transportation data)
        $this->call(BookingsSeeder::class);
    }
}
