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

        // Resolve stations by city name — stays correct as more stations are added.
        $stations = DB::table('admin_stations')
            ->whereIn('city', ['Kigali', 'Musanze', 'Huye'])
            ->get()
            ->keyBy('city');

        if ($stations->count() < 3) {
            $this->command->error('Required stations (Kigali, Musanze, Huye) not found. Run AdminSeeder first.');
            return;
        }

        // Per-route metadata: travel time offset (hours) and ticket price (RWF)
        $routeMeta = [
            'Kigali-Musanze' => ['offset' => 2.5, 'price' => 4000],
            'Kigali-Huye'    => ['offset' => 2.5, 'price' => 4000],
            'Musanze-Kigali' => ['offset' => 2.5, 'price' => 4000],
            'Musanze-Huye'   => ['offset' => 5.0, 'price' => 7000],
            'Huye-Kigali'    => ['offset' => 2.5, 'price' => 4000],
            'Huye-Musanze'   => ['offset' => 5.0, 'price' => 7000],
        ];

        // Build all directional route pairs
        $routePairs = [];
        foreach ($stations as $fromCity => $fromStation) {
            foreach ($stations as $toCity => $toStation) {
                $key = "{$fromCity}-{$toCity}";
                if ($fromStation->id !== $toStation->id && isset($routeMeta[$key])) {
                    $routePairs[] = [
                        'key'     => $key,
                        'from_id' => $fromStation->id,
                        'to_id'   => $toStation->id,
                        'offset'  => $routeMeta[$key]['offset'],
                        'price'   => $routeMeta[$key]['price'],
                    ];
                }
            }
        }

        // Departures every hour from 05:00 to 20:00
        $departureTimes = [
            '05:00', '06:00', '07:00', '08:00',
            '09:00', '10:00', '11:00', '12:00',
            '13:00', '14:00', '15:00', '16:00',
            '17:00', '18:00', '19:00', '20:00',
        ];

        $existingAgencies = Agency::pluck('id', 'name')->toArray();
        $now = now();

        foreach ($agencyNames as $name) {
            if (isset($existingAgencies[$name])) {
                echo "Agency: {$name} already exists — skipping\n";
                continue;
            }

            $agency   = Agency::create(['name' => $name, 'created_by' => null]);
            $agencyId = $agency->id;
            echo "Agency: {$name} (ID: {$agencyId})\n";

            $routeBatch = [];
            $tripBatch  = [];

            foreach ($routePairs as $route) {
                // One agency_route per directional route pair
                $routeBatch[] = [
                    'agency_id'       => $agencyId,
                    'from_station_id' => $route['from_id'],
                    'to_station_id'   => $route['to_id'],
                    'created_at'      => $now,
                    'updated_at'      => $now,
                ];

                // One trip per departure time on this route
                foreach ($departureTimes as $dep) {
                    $depTime = \Carbon\Carbon::parse($dep);
                    $arrTime = $depTime->copy()->addHours($route['offset']);

                    $tripBatch[] = [
                        'agency_id'              => $agencyId,
                        'from_station_id'        => $route['from_id'],
                        'to_station_id'          => $route['to_id'],
                        'departure_time'         => $dep . ':00',
                        'estimated_arrival_time' => $arrTime->format('H:i:00'),
                        'price'                  => $route['price'],
                        'total_seats'            => 30,
                        'active'                 => 1,
                        'created_at'             => $now,
                        'updated_at'             => $now,
                    ];
                }
            }

            // Insert agency_routes first (6 per agency — management layer)
            DB::table('agency_routes')->insert($routeBatch);
            echo "  agency_routes: " . count($routeBatch) . " inserted\n";

            // Insert trips in chunks (96 per agency — schedule layer)
            foreach (array_chunk($tripBatch, 50) as $chunk) {
                DB::table('trips')->insert($chunk);
            }
            echo "  trips: " . count($tripBatch) . " inserted\n";
        }

        echo "\nTotal agencies:      " . DB::table('agencies')->count() . "\n";
        echo "Total agency_routes: " . DB::table('agency_routes')->count() . "\n";
        echo "Total trips:         " . DB::table('trips')->count() . "\n";
    }
}
