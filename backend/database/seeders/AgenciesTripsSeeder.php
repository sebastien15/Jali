<?php

namespace Database\Seeders;

use App\Models\Agency;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AgenciesTripsSeeder extends Seeder
{
    public function run(): void
    {
        $agencyNames = [
            'Trinity',
            'Virunga',
            'International',
            'RFTC',
            'RITCO',
            'Volcano',
            'Stella',
            'Ruhire',
        ];

        // Station IDs: 1=Kigali, 2=Musanze, 3=Huye
        $stations = [
            ['id' => 1, 'city' => 'Kigali'],
            ['id' => 2, 'city' => 'Musanze'],
            ['id' => 3, 'city' => 'Huye'],
        ];

        // Departure times: 5:00 AM to 8:00 PM, every hour
        $departureTimes = [
            '05:00', '06:00', '07:00', '08:00',
            '09:00', '10:00', '11:00', '12:00',
            '13:00', '14:00', '15:00', '16:00',
            '17:00', '18:00', '19:00', '20:00',
        ];

        // Estimated arrival offsets (hours) per route
        $arrivalOffsets = [
            'Kigali-Musanze'   => 2.5,
            'Kigali-Huye'      => 2.5,
            'Musanze-Kigali'   => 2.5,
            'Musanze-Huye'     => 5.0,
            'Huye-Kigali'      => 2.5,
            'Huye-Musanze'     => 5.0,
        ];

        // Prices per route (RWF)
        $routePrices = [
            'Kigali-Musanze'   => 4000,
            'Kigali-Huye'      => 4000,
            'Musanze-Kigali'   => 4000,
            'Musanze-Huye'     => 7000,
            'Huye-Kigali'      => 4000,
            'Huye-Musanze'     => 7000,
        ];

        // All station pairs (from ≠ to)
        $routePairs = [];
        foreach ($stations as $from) {
            foreach ($stations as $to) {
                if ($from['id'] !== $to['id']) {
                    $routePairs[] = [
                        'from_id'   => $from['id'],
                        'from_city' => $from['city'],
                        'to_id'     => $to['id'],
                        'to_city'   => $to['city'],
                    ];
                }
            }
        }

        // Get existing agency names to avoid duplicates
        $existingAgencies = Agency::pluck('id', 'name')->toArray();

        foreach ($agencyNames as $name) {
            if (!isset($existingAgencies[$name])) {
                $agency = Agency::create(['name' => $name, 'created_by' => null]);
                $agencyId = $agency->id;
                echo "Agency: {$name} (ID: {$agencyId})\n";
            } else {
                $agencyId = $existingAgencies[$name];
                echo "Agency: {$name} already exists (ID: {$agencyId})\n";
                continue; // Skip if already seeded
            }

            $tripBatch = [];
            $now = now();

            foreach ($routePairs as $route) {
                $routeKey = "{$route['from_city']}-{$route['to_city']}";
                $price = $routePrices[$routeKey] ?? 5000;
                $offsetHours = $arrivalOffsets[$routeKey] ?? 3.0;

                foreach ($departureTimes as $departure) {
                    $depTime = \Carbon\Carbon::parse($departure);
                    $arrTime = $depTime->copy()->addHours($offsetHours);

                    $tripBatch[] = [
                        'agency_id'              => $agencyId,
                        'from_station_id'        => $route['from_id'],
                        'to_station_id'          => $route['to_id'],
                        'departure_time'         => $departure . ':00',
                        'estimated_arrival_time' => $arrTime->format('H:i:00'),
                        'price'                  => $price,
                        'total_seats'            => 30,
                        'active'                 => 1,
                        'created_at'             => $now,
                        'updated_at'             => $now,
                    ];
                }
            }

            // Batch insert 96 trips per agency (6 routes × 16 departures)
            if (!empty($tripBatch)) {
                // Chunk to avoid memory issues
                $chunks = array_chunk($tripBatch, 50);
                foreach ($chunks as $chunk) {
                    DB::table('trips')->insert($chunk);
                }
                echo "  Inserted " . count($tripBatch) . " trips for {$name}\n";
            }
        }

        $totalTrips = DB::table('trips')->count();
        $totalAgencies = DB::table('agencies')->count();
        echo "\nTotal agencies: {$totalAgencies}\n";
        echo "Total trips: {$totalTrips}\n";
    }
}
