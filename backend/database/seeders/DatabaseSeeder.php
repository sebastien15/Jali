<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Roles & Permissions (must be first)
        $this->call(RolesAndPermissionsSeeder::class);

        // 2. Admin users
        $this->call(AdminSeeder::class);

        // 3. Regular users (assigns roles)
        $this->call(UsersSeeder::class);

        // 4. Booking pickup locations (all 16 national terminals)
        $this->call(LocationsSeeder::class);

        // 5. Bus terminals (admin_stations) — all 16 terminals with coordinates
        //    Also truncates trips, agency_routes, corridor_terminals
        $this->call(AdminStationsSeeder::class);

        // 6. Corridors (CRD-01 to CRD-08) + ordered terminal stops
        $this->call(CorridorsSeeder::class);

        // 7. Legacy transportation data
        $this->call(BusesSeeder::class);
        $this->call(CarRentalsSeeder::class);
        $this->call(PrivateSeatsSeeder::class);

        // 8. Agencies (43 total) + corridor routes + trips
        $this->call(AgenciesTripsSeeder::class);

        // 9. Sample bookings
        $this->call(BookingsSeeder::class);
    }
}
