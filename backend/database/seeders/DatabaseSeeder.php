<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Reference data — safe for every environment.
        // 1. Roles & Permissions (must be first)
        $this->call(RolesAndPermissionsSeeder::class);

        // 2. Admin users (password: SEED_ADMIN_PASSWORD, see AdminSeeder)
        $this->call(AdminSeeder::class);

        // 3. Booking pickup locations (all 16 national terminals)
        $this->call(LocationsSeeder::class);

        // 4. Bus terminals (admin_stations) — all 16 terminals with coordinates
        //    Also truncates trips, agency_routes, corridor_terminals
        $this->call(AdminStationsSeeder::class);

        // 5. Corridors (CRD-01 to CRD-08) + ordered terminal stops
        $this->call(CorridorsSeeder::class);

        // 6. Agencies (43 total) + routes + departures
        $this->call(AgenciesTripsSeeder::class);

        // Demo data — never seeded into production.
        if (app()->isProduction()) {
            return;
        }

        // 7. Demo passengers & drivers
        $this->call(UsersSeeder::class);

        // 8. Legacy transportation data (cars, private seats, buses)
        $this->call(BusesSeeder::class);
        $this->call(CarRentalsSeeder::class);
        $this->call(PrivateSeatsSeeder::class);

        // 9. Sample bookings
        $this->call(BookingsSeeder::class);
    }
}
