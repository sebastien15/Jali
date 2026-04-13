<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CorridorsSeeder extends Seeder
{
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();
        DB::table('corridor_terminals')->truncate();
        DB::table('corridors')->truncate();
        Schema::enableForeignKeyConstraints();

        $now = now();

        // ── 8 RURA Official Corridors ──
        $corridors = [
            'CRD-01' => [
                'name'        => 'North',
                'description' => 'Kigali – Rulindo – Gicumbi – Gatuna',
                'stops'       => ['Nyabugogo Bus Park', 'Rulindo Terminal', 'Gicumbi Terminal'],
            ],
            'CRD-02' => [
                'name'        => 'North-West',
                'description' => 'Kigali – Musanze – Rubavu',
                'stops'       => ['Nyabugogo Bus Park', 'Musanze Terminal', 'Rubavu Terminal'],
            ],
            'CRD-03' => [
                'name'        => 'West',
                'description' => 'Kigali – Muhanga – Karongi',
                'stops'       => ['Nyabugogo Bus Park', 'Muhanga Terminal', 'Karongi Terminal'],
            ],
            'CRD-04' => [
                'name'        => 'Central-West',
                'description' => 'Kigali – Muhanga – Ngororero – Rubavu',
                'stops'       => ['Nyabugogo Bus Park', 'Muhanga Terminal', 'Rubavu Terminal'],
            ],
            'CRD-05' => [
                'name'        => 'South',
                'description' => 'Kigali – Muhanga – Huye – Nyanza – Rusizi',
                'stops'       => ['Nyabugogo Bus Park', 'Muhanga Terminal', 'Huye Terminal', 'Nyanza Terminal', 'Rusizi Terminal'],
            ],
            'CRD-06' => [
                'name'        => 'East A',
                'description' => 'Kigali – Remera – Rwamagana – Kayonza',
                'stops'       => ['Nyabugogo Bus Park', 'Remera Terminal', 'Rwamagana Terminal', 'Kayonza Terminal'],
            ],
            'CRD-07' => [
                'name'        => 'East B',
                'description' => 'Kigali – Rwamagana – Kayonza – Nyagatare',
                'stops'       => ['Nyabugogo Bus Park', 'Remera Terminal', 'Rwamagana Terminal', 'Kayonza Terminal', 'Nyagatare Terminal'],
            ],
            'CRD-08' => [
                'name'        => 'East C',
                'description' => 'Kigali – Rwamagana – Kayonza – Ngoma – Rusumo',
                'stops'       => ['Nyabugogo Bus Park', 'Remera Terminal', 'Rwamagana Terminal', 'Kayonza Terminal', 'Ngoma Terminal'],
            ],
        ];

        // Build terminal name → id map
        $terminalIds = DB::table('admin_stations')
            ->pluck('id', 'name')
            ->toArray();

        foreach ($corridors as $code => $data) {
            $corridorId = DB::table('corridors')->insertGetId([
                'code'        => $code,
                'name'        => $data['name'],
                'description' => $data['description'],
                'created_at'  => $now,
                'updated_at'  => $now,
            ]);

            foreach ($data['stops'] as $order => $terminalName) {
                $terminalId = $terminalIds[$terminalName] ?? null;

                if (!$terminalId) {
                    $this->command->warn("  Terminal not found: {$terminalName}");
                    continue;
                }

                DB::table('corridor_terminals')->insert([
                    'corridor_id' => $corridorId,
                    'terminal_id' => $terminalId,
                    'stop_order'  => $order + 1,
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ]);
            }

            $stopCount = count($data['stops']);
            $this->command->info("  {$code} ({$data['name']}): {$stopCount} stops");
        }

        $this->command->info('CorridorsSeeder: ' . count($corridors) . ' corridors seeded.');
    }
}
