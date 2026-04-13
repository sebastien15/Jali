<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AgenciesTripsSeeder extends Seeder
{
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();
        DB::table('trips')->truncate();
        DB::table('agency_routes')->truncate();
        DB::table('agencies')->truncate();
        Schema::enableForeignKeyConstraints();

        $this->command->info('Loading terminals and corridors...');

        // Terminal name → id (keyed by display name, then resolved to slug)
        $tByName = DB::table('admin_stations')->pluck('id', 'name')->toArray();
        $t = $this->buildTerminalMap($tByName);

        // Corridor code → id
        $c = DB::table('corridors')->pluck('id', 'code')->toArray();

        if (empty($t)) {
            $this->command->error('No terminals found. Run AdminStationsSeeder first.');
            return;
        }
        if (empty($c)) {
            $this->command->error('No corridors found. Run CorridorsSeeder first.');
            return;
        }

        // ── Reusable time sets ──
        $generic = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
        $fq30    = $this->freq('05:00', '20:00', 30);   // every 30 min, 05:00–20:00
        $fq30b   = $this->freq('05:30', '19:30', 30);   // Volcano NW
        $fq30c   = $this->freq('05:00', '21:00', 30);   // Volcano South (longer day)
        $fq30v   = $this->freq('05:00', '20:00', 30);   // Virunga
        $fq30s   = $this->freq('05:00', '19:00', 30);   // Stella
        $fq45    = $this->freq('06:00', '18:30', 45);   // Omega

        // ── Route tuple: [from_slug, to_slug, corridor_code, times[], price_rwf, travel_min, seats, bidir] ──
        // bidir=true → also create the reverse route (same times from destination)
        $agencies = [

            // ── RITCO Ltd — All corridors, fixed RURA-published times ──
            [
                'name'   => 'RITCO Ltd',
                'routes' => [
                    ['nyabugogo', 'rusizi',    'CRD-05', ['05:00','06:00','07:00','09:00','11:00','13:00'], 7000, 300, 45, true],
                    ['nyabugogo', 'karongi',   'CRD-03', ['06:30','08:30','11:30','14:00'],               3000, 180, 45, true],
                    ['nyabugogo', 'nyagatare', 'CRD-07', ['06:00','07:00','08:00','09:00','10:00','12:00','14:00','16:00'], 3500, 210, 45, true],
                    ['nyabugogo', 'rubavu',    'CRD-02', ['05:30','07:30','09:30','11:30','13:30','15:30','17:30'], 2500, 165, 45, true],
                    ['nyabugogo', 'ngoma',     'CRD-08', ['07:00','09:00','12:00','15:00'],               2500, 165, 45, true],
                    ['nyabugogo', 'huye',      'CRD-05', $generic,                                       2500, 150, 45, true],
                    ['nyabugogo', 'musanze',   'CRD-02', $generic,                                       1500, 120, 45, true],
                    ['nyabugogo', 'kayonza',   'CRD-06', $generic,                                       2000, 120, 45, true],
                    ['nyabugogo', 'gicumbi',   'CRD-01', $generic,                                       1500,  90, 45, true],
                    ['nyabugogo', 'muhanga',   'CRD-05', $generic,                                       1000,  60, 45, true],
                ],
            ],

            // ── Volcano Ltd — CRD-02 (NW) + CRD-05 (South), frequency 30 min ──
            [
                'name'   => 'Volcano Ltd',
                'routes' => [
                    ['nyabugogo', 'rubavu', 'CRD-02', $fq30b, 2500, 165, 72, true],
                    ['nyabugogo', 'huye',   'CRD-05', $fq30c, 2500, 150, 72, true],
                ],
            ],

            // ── Virunga Express Ltd — CRD-01 (North) + CRD-02 (NW), frequency 30 min ──
            [
                'name'   => 'Virunga Express Ltd',
                'routes' => [
                    ['nyabugogo', 'gicumbi', 'CRD-01', $fq30v, 1500,  90, 72, true],
                    ['nyabugogo', 'musanze', 'CRD-02', $fq30v, 1500, 120, 72, true],
                ],
            ],

            // ── Stella Express Ltd — CRD-01 (North), frequency 30 min ──
            [
                'name'   => 'Stella Express Ltd',
                'routes' => [
                    ['nyabugogo', 'gicumbi', 'CRD-01', $fq30s, 1500, 90, 72, true],
                ],
            ],

            // ── Horizon Express Ltd — CRD-05 (South), frequency 30 min ──
            [
                'name'   => 'Horizon Express Ltd',
                'routes' => [
                    ['nyabugogo', 'huye',   'CRD-05', $fq30, 2500, 150, 72, true],
                    ['nyabugogo', 'rusizi', 'CRD-05', $generic, 7000, 300, 72, true],
                ],
            ],

            // ── Omega Ltd — CRD-06 (partial: Nyabugogo → Rwamagana only) + CRD-07, freq 45 min ──
            [
                'name'   => 'Omega Ltd',
                'routes' => [
                    ['nyabugogo', 'rwamagana', 'CRD-06', $fq45, 1500, 75, 72, true], // partial corridor
                    ['nyabugogo', 'nyagatare', 'CRD-07', $fq45, 3500, 210, 72, true],
                ],
            ],

            // ── Select Express Agency Ltd — CRD-06 (partial) + CRD-07 ──
            [
                'name'   => 'Select Express Agency Ltd',
                'routes' => [
                    ['nyabugogo', 'rwamagana', 'CRD-06', $generic, 1500, 75, 72, true],
                    ['nyabugogo', 'nyagatare', 'CRD-07', $generic, 3500, 210, 72, true],
                ],
            ],

            // ── Capital Ltd — CRD-03 (West) + CRD-05 (South), freq 30 min ──
            [
                'name'   => 'Capital Ltd',
                'routes' => [
                    ['nyabugogo', 'karongi', 'CRD-03', $this->freq('06:00', '19:00', 30), 3000, 180, 72, true],
                    ['nyabugogo', 'huye',    'CRD-05', $this->freq('06:00', '18:00', 30), 2500, 150, 72, true],
                ],
            ],

            // ── Gicumbi Transport Cooperative — CRD-01 ──
            [
                'name'   => 'Gicumbi Transport Cooperative',
                'routes' => [
                    ['nyabugogo', 'gicumbi', 'CRD-01', $generic, 1500, 90, 30, true],
                ],
            ],

            // ── Kivu Belt Express Ltd — CRD-03 + CRD-04 (West) ──
            [
                'name'   => 'Kivu Belt Express Ltd',
                'routes' => [
                    ['nyabugogo', 'karongi', 'CRD-03', $generic, 3000, 180, 45, true],
                    ['nyabugogo', 'rubavu',  'CRD-04', $generic, 2500, 165, 45, true],
                ],
            ],

            // ── Ebenezer Express Ltd — CRD-06 + CRD-07 (East) ──
            [
                'name'   => 'Ebenezer Express Ltd',
                'routes' => [
                    ['nyabugogo', 'kayonza',   'CRD-06', $generic, 2000, 120, 45, true],
                    ['nyabugogo', 'nyagatare', 'CRD-07', $generic, 3500, 210, 45, true],
                ],
            ],

            // ── Ruhire Express Ltd — CRD-01 + CRD-02 ──
            [
                'name'   => 'Ruhire Express Ltd',
                'routes' => [
                    ['nyabugogo', 'gicumbi', 'CRD-01', $generic, 1500,  90, 45, true],
                    ['nyabugogo', 'musanze', 'CRD-02', $generic, 1500, 120, 45, true],
                ],
            ],

            // ── Matunda Express Ltd — CRD-06 + CRD-07 + CRD-08 (East) ──
            [
                'name'   => 'Matunda Express Ltd',
                'routes' => [
                    ['nyabugogo', 'rwamagana', 'CRD-06', $generic, 1500, 75,  45, true],
                    ['nyabugogo', 'nyagatare', 'CRD-07', $generic, 3500, 210, 45, true],
                    ['nyabugogo', 'ngoma',     'CRD-08', $generic, 2500, 165, 45, true],
                ],
            ],

            // ── International Express Ltd — CRD-05 + CRD-03 ──
            [
                'name'   => 'International Express Ltd',
                'routes' => [
                    ['nyabugogo', 'rusizi',  'CRD-05', $generic, 7000, 300, 45, true],
                    ['nyabugogo', 'karongi', 'CRD-03', $generic, 3000, 180, 45, true],
                ],
            ],

            // ── Shalom Transportation Limited — CRD-05 ──
            [
                'name'   => 'Shalom Transportation Limited',
                'routes' => [
                    ['nyabugogo', 'huye',   'CRD-05', $generic, 2500, 150, 45, true],
                    ['nyabugogo', 'rusizi', 'CRD-05', $generic, 7000, 300, 45, true],
                ],
            ],

            // ── Royal Express — CRD-05 + CRD-06 ──
            [
                'name'   => 'Royal Express',
                'routes' => [
                    ['nyabugogo', 'huye',    'CRD-05', $generic, 2500, 150, 45, true],
                    ['nyabugogo', 'kayonza', 'CRD-06', $generic, 2000, 120, 45, true],
                ],
            ],

            // ── Star Express Ltd — CRD-06 + CRD-07 ──
            [
                'name'   => 'Star Express Ltd',
                'routes' => [
                    ['nyabugogo', 'kayonza',   'CRD-06', $generic, 2000, 120, 45, true],
                    ['nyabugogo', 'nyagatare', 'CRD-07', $generic, 3500, 210, 45, true],
                ],
            ],

            // ── Different Express Ltd — CRD-06 + CRD-07 ──
            [
                'name'   => 'Different Express Ltd',
                'routes' => [
                    ['nyabugogo', 'rwamagana', 'CRD-06', $generic, 1500, 75,  45, true],
                    ['nyabugogo', 'nyagatare', 'CRD-07', $generic, 3500, 210, 45, true],
                ],
            ],

            // ── City Express Ltd — CRD-06 + CRD-07 ──
            [
                'name'   => 'City Express Ltd',
                'routes' => [
                    ['nyabugogo', 'kayonza',   'CRD-06', $generic, 2000, 120, 45, true],
                    ['nyabugogo', 'nyagatare', 'CRD-07', $generic, 3500, 210, 45, true],
                ],
            ],

            // ── Alpha Express Company Ltd — CRD-01 + CRD-06 ──
            [
                'name'   => 'Alpha Express Company Ltd',
                'routes' => [
                    ['nyabugogo', 'gicumbi',   'CRD-01', $generic, 1500, 90,  45, true],
                    ['nyabugogo', 'kayonza',   'CRD-06', $generic, 2000, 120, 45, true],
                ],
            ],

            // ── Fidelity Express Ltd — CRD-03 + CRD-04 (West) ──
            [
                'name'   => 'Fidelity Express Ltd',
                'routes' => [
                    ['nyabugogo', 'karongi', 'CRD-03', $generic, 3000, 180, 45, true],
                    ['nyabugogo', 'rubavu',  'CRD-04', $generic, 2500, 165, 45, true],
                ],
            ],

            // ── Excel Travel & Tours Agency Ltd — CRD-02 + CRD-05 ──
            [
                'name'   => 'Excel Travel & Tours Agency Ltd',
                'routes' => [
                    ['nyabugogo', 'rubavu', 'CRD-02', $generic, 2500, 165, 45, true],
                    ['nyabugogo', 'huye',   'CRD-05', $generic, 2500, 150, 45, true],
                ],
            ],

            // ── Kigali Coach Tours & Travel Ltd — CRD-02 + CRD-05 ──
            [
                'name'   => 'Kigali Coach Tours & Travel Ltd',
                'routes' => [
                    ['nyabugogo', 'rubavu', 'CRD-02', $generic, 2500, 165, 45, true],
                    ['nyabugogo', 'rusizi', 'CRD-05', $generic, 7000, 300, 45, true],
                ],
            ],

            // ── Indonyi Express — CRD-06 + CRD-07 + CRD-08 ──
            [
                'name'   => 'Indonyi Express',
                'routes' => [
                    ['nyabugogo', 'kayonza',   'CRD-06', $generic, 2000, 120, 45, true],
                    ['nyabugogo', 'nyagatare', 'CRD-07', $generic, 3500, 210, 45, true],
                    ['nyabugogo', 'ngoma',     'CRD-08', $generic, 2500, 165, 45, true],
                ],
            ],

            // ── Tripartite Tours Ltd — CRD-02 + CRD-05 ──
            [
                'name'   => 'Tripartite Tours Ltd',
                'routes' => [
                    ['nyabugogo', 'musanze', 'CRD-02', $generic, 1500, 120, 45, true],
                    ['nyabugogo', 'huye',    'CRD-05', $generic, 2500, 150, 45, true],
                ],
            ],

            // ── Jali Transport Ltd — CRD-01 + CRD-06 ──
            [
                'name'   => 'Jali Transport Ltd',
                'routes' => [
                    ['nyabugogo', 'gicumbi',   'CRD-01', $generic, 1500, 90,  45, true],
                    ['nyabugogo', 'kayonza',   'CRD-06', $generic, 2000, 120, 45, true],
                ],
            ],

            // ── La Colombe Express Ltd — CRD-05 ──
            [
                'name'   => 'La Colombe Express Ltd',
                'routes' => [
                    ['nyabugogo', 'huye',   'CRD-05', $generic, 2500, 150, 45, true],
                    ['nyabugogo', 'rusizi', 'CRD-05', $generic, 7000, 300, 45, true],
                ],
            ],

            // ── Yahoo Car Express Ltd — CRD-06 + CRD-07 ──
            [
                'name'   => 'Yahoo Car Express Ltd',
                'routes' => [
                    ['nyabugogo', 'rwamagana', 'CRD-06', $generic, 1500, 75,  45, true],
                    ['nyabugogo', 'nyagatare', 'CRD-07', $generic, 3500, 210, 45, true],
                ],
            ],

            // ── Mash Bus Services Ltd — CRD-07 (Kenya ↔ Rwanda) ──
            [
                'name'   => 'Mash Bus Services Ltd',
                'routes' => [
                    ['nyabugogo', 'nyagatare', 'CRD-07', ['07:00', '14:00'], 3500, 210, 60, true],
                ],
            ],

            // ── EA Bus & Travel Limited — CRD-07 + CRD-08 ──
            [
                'name'   => 'EA Bus & Travel Limited',
                'routes' => [
                    ['nyabugogo', 'nyagatare', 'CRD-07', $generic, 3500, 210, 60, true],
                    ['nyabugogo', 'ngoma',     'CRD-08', $generic, 2500, 165, 60, true],
                ],
            ],

            // ── Simba Coach — CRD-07 (East Africa) ──
            [
                'name'   => 'Simba Coach',
                'routes' => [
                    ['nyabugogo', 'nyagatare', 'CRD-07', ['07:00', '14:00'], 3500, 210, 60, true],
                ],
            ],

            // ── Modern Coast — CRD-05 + CRD-07 (East Africa) ──
            [
                'name'   => 'Modern Coast',
                'routes' => [
                    ['nyabugogo', 'rusizi',    'CRD-05', ['07:00', '14:00'], 7000, 300, 60, true],
                    ['nyabugogo', 'nyagatare', 'CRD-07', ['07:00', '14:00'], 3500, 210, 60, true],
                ],
            ],

            // ── Trinity Transporters & Distributors Co Ltd — CRD-01 + CRD-02 + CRD-06 ──
            [
                'name'   => 'Trinity Transporters & Distributors Co Ltd',
                'routes' => [
                    ['nyabugogo', 'gicumbi',   'CRD-01', $generic, 1500, 90,  45, true],
                    ['nyabugogo', 'musanze',   'CRD-02', $generic, 1500, 120, 45, true],
                    ['nyabugogo', 'kayonza',   'CRD-06', $generic, 2000, 120, 45, true],
                ],
            ],

            // ── Kigali Bus Services Ltd — CRD-06 (Kigali city routes) ──
            [
                'name'   => 'Kigali Bus Services Ltd',
                'routes' => [
                    ['nyabugogo', 'remera', 'CRD-06',
                     ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'],
                     400, 30, 72, true],
                ],
            ],

            // ── Terminal operators — no route service ──
            ['name' => 'Nyabugogo TC',  'routes' => []],
            ['name' => 'Kayonza TC',    'routes' => []],
            ['name' => 'Musanze TC',    'routes' => []],
            ['name' => 'Nyagatare TC',  'routes' => []],
            ['name' => 'Ngoma TC',      'routes' => []],
            ['name' => 'Muhanga TC',    'routes' => []],
            ['name' => 'Huye TC',       'routes' => []],
            ['name' => 'Rusizi TC',     'routes' => []],
            ['name' => 'Rubavu TC',     'routes' => []],
        ];

        $now         = now();
        $totalRoutes = 0;
        $totalTrips  = 0;

        foreach ($agencies as $agencyDef) {
            $agencyId = DB::table('agencies')->insertGetId([
                'name'       => $agencyDef['name'],
                'created_by' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            if (empty($agencyDef['routes'])) {
                $this->command->info("  {$agencyDef['name']}: terminal operator (no routes)");
                continue;
            }

            $routeBatch = [];
            $tripBatch  = [];

            foreach ($agencyDef['routes'] as [$fromSlug, $toSlug, $corridorCode, $times, $price, $minutes, $seats, $bidir]) {
                $fromId     = $t[$fromSlug] ?? null;
                $toId       = $t[$toSlug] ?? null;
                $corridorId = $c[$corridorCode] ?? null;

                if (!$fromId || !$toId) {
                    $this->command->warn("    Missing terminal: {$fromSlug} or {$toSlug}");
                    continue;
                }

                // Forward direction
                $routeBatch[] = [
                    'agency_id'       => $agencyId,
                    'corridor_id'     => $corridorId,
                    'from_station_id' => $fromId,
                    'to_station_id'   => $toId,
                    'created_at'      => $now,
                    'updated_at'      => $now,
                ];
                foreach ($times as $dep) {
                    $arr          = Carbon::parse($dep)->addMinutes($minutes)->format('H:i:s');
                    $tripBatch[]  = $this->tripRow($agencyId, $fromId, $toId, $dep, $arr, $price, $seats, $now);
                }

                // Reverse direction
                if ($bidir) {
                    $routeBatch[] = [
                        'agency_id'       => $agencyId,
                        'corridor_id'     => $corridorId,
                        'from_station_id' => $toId,
                        'to_station_id'   => $fromId,
                        'created_at'      => $now,
                        'updated_at'      => $now,
                    ];
                    foreach ($times as $dep) {
                        $arr         = Carbon::parse($dep)->addMinutes($minutes)->format('H:i:s');
                        $tripBatch[] = $this->tripRow($agencyId, $toId, $fromId, $dep, $arr, $price, $seats, $now);
                    }
                }
            }

            DB::table('agency_routes')->insert($routeBatch);
            foreach (array_chunk($tripBatch, 200) as $chunk) {
                DB::table('trips')->insert($chunk);
            }

            $totalRoutes += count($routeBatch);
            $totalTrips  += count($tripBatch);

            $this->command->info("  {$agencyDef['name']}: " . count($routeBatch) . " routes, " . count($tripBatch) . " trips");
        }

        $this->command->info('');
        $this->command->info('AgenciesTripsSeeder complete:');
        $this->command->info('  Agencies : ' . DB::table('agencies')->count());
        $this->command->info('  Routes   : ' . $totalRoutes);
        $this->command->info('  Trips    : ' . $totalTrips);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function buildTerminalMap(array $byName): array
    {
        $nameToSlug = [
            'Nyabugogo Bus Park'  => 'nyabugogo',
            'Remera Terminal'     => 'remera',
            'Rwamagana Terminal'  => 'rwamagana',
            'Kayonza Terminal'    => 'kayonza',
            'Nyagatare Terminal'  => 'nyagatare',
            'Ngoma Terminal'      => 'ngoma',
            'Musanze Terminal'    => 'musanze',
            'Gicumbi Terminal'    => 'gicumbi',
            'Huye Terminal'       => 'huye',
            'Muhanga Terminal'    => 'muhanga',
            'Nyanza Terminal'     => 'nyanza',
            'Rubavu Terminal'     => 'rubavu',
            'Rusizi Terminal'     => 'rusizi',
            'Karongi Terminal'    => 'karongi',
            'Nyamata Terminal'    => 'nyamata',
            'Rulindo Terminal'    => 'rulindo',
        ];

        $map = [];
        foreach ($byName as $name => $id) {
            $slug = $nameToSlug[$name] ?? null;
            if ($slug) {
                $map[$slug] = $id;
            }
        }
        return $map;
    }

    private function freq(string $start, string $end, int $interval): array
    {
        $times   = [];
        $current = Carbon::parse($start);
        $endTime = Carbon::parse($end);

        while ($current->lessThanOrEqualTo($endTime)) {
            $times[] = $current->format('H:i');
            $current->addMinutes($interval);
        }

        return $times;
    }

    private function tripRow(int $agencyId, int $fromId, int $toId, string $dep, string $arr, int $price, int $seats, $now): array
    {
        return [
            'agency_id'              => $agencyId,
            'from_station_id'        => $fromId,
            'to_station_id'          => $toId,
            'departure_time'         => $dep . ':00',
            'estimated_arrival_time' => $arr,
            'price'                  => $price,
            'total_seats'            => $seats,
            'active'                 => true,
            'created_at'             => $now,
            'updated_at'             => $now,
        ];
    }
}
