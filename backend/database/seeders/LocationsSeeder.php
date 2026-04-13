<?php

namespace Database\Seeders;

use App\Models\Location;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LocationsSeeder extends Seeder
{
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();
        DB::table('locations')->truncate();
        Schema::enableForeignKeyConstraints();

        $terminals = [
            [
                'name'      => 'Nyabugogo Bus Park',
                'type'      => 'bus_station',
                'city'      => 'Kigali',
                'address'   => 'Nyabugogo, Gasabo, Kigali',
                'latitude'  => -1.9407,
                'longitude' => 30.0447,
            ],
            [
                'name'      => 'Remera Terminal',
                'type'      => 'bus_station',
                'city'      => 'Kigali',
                'address'   => 'Remera, Gasabo, Kigali',
                'latitude'  => -1.9585,
                'longitude' => 30.1188,
            ],
            [
                'name'      => 'Rwamagana Terminal',
                'type'      => 'bus_station',
                'city'      => 'Rwamagana',
                'address'   => 'Rwamagana Bus Park, Eastern Province',
                'latitude'  => -1.9525,
                'longitude' => 30.4378,
            ],
            [
                'name'      => 'Kayonza Terminal',
                'type'      => 'bus_station',
                'city'      => 'Kayonza',
                'address'   => 'Kayonza Bus Park, Eastern Province',
                'latitude'  => -1.9021,
                'longitude' => 30.5073,
            ],
            [
                'name'      => 'Nyagatare Terminal',
                'type'      => 'bus_station',
                'city'      => 'Nyagatare',
                'address'   => 'Nyagatare Bus Park, Eastern Province',
                'latitude'  => -1.2931,
                'longitude' => 30.3250,
            ],
            [
                'name'      => 'Ngoma Terminal',
                'type'      => 'bus_station',
                'city'      => 'Ngoma',
                'address'   => 'Kibungo, Ngoma, Eastern Province',
                'latitude'  => -2.1491,
                'longitude' => 30.5478,
            ],
            [
                'name'      => 'Musanze Terminal',
                'type'      => 'bus_station',
                'city'      => 'Musanze',
                'address'   => 'Musanze Bus Park, Northern Province',
                'latitude'  => -1.4692,
                'longitude' => 29.5817,
            ],
            [
                'name'      => 'Gicumbi Terminal',
                'type'      => 'bus_station',
                'city'      => 'Gicumbi',
                'address'   => 'Byumba, Gicumbi, Northern Province',
                'latitude'  => -1.5887,
                'longitude' => 30.0551,
            ],
            [
                'name'      => 'Huye Terminal',
                'type'      => 'bus_station',
                'city'      => 'Huye',
                'address'   => 'Butare, Huye, Southern Province',
                'latitude'  => -2.5167,
                'longitude' => 29.7417,
            ],
            [
                'name'      => 'Muhanga Terminal',
                'type'      => 'bus_station',
                'city'      => 'Muhanga',
                'address'   => 'Gitarama, Muhanga, Southern Province',
                'latitude'  => -2.0831,
                'longitude' => 29.7516,
            ],
            [
                'name'      => 'Nyanza Terminal',
                'type'      => 'bus_station',
                'city'      => 'Nyanza',
                'address'   => 'Nyanza Bus Park, Southern Province',
                'latitude'  => -2.3514,
                'longitude' => 29.7512,
            ],
            [
                'name'      => 'Rubavu Terminal',
                'type'      => 'bus_station',
                'city'      => 'Rubavu',
                'address'   => 'Gisenyi, Rubavu, Western Province',
                'latitude'  => -1.7000,
                'longitude' => 29.2500,
            ],
            [
                'name'      => 'Rusizi Terminal',
                'type'      => 'bus_station',
                'city'      => 'Rusizi',
                'address'   => 'Kamembe, Rusizi, Western Province',
                'latitude'  => -2.4620,
                'longitude' => 28.9073,
            ],
            [
                'name'      => 'Karongi Terminal',
                'type'      => 'bus_station',
                'city'      => 'Karongi',
                'address'   => 'Kibuye, Karongi, Western Province',
                'latitude'  => -2.0617,
                'longitude' => 29.3483,
            ],
            [
                'name'      => 'Nyamata Terminal',
                'type'      => 'bus_station',
                'city'      => 'Nyamata',
                'address'   => 'Nyamata Bus Park, Bugesera, Eastern Province',
                'latitude'  => -2.1483,
                'longitude' => 30.0907,
            ],
            [
                'name'      => 'Rulindo Terminal',
                'type'      => 'bus_station',
                'city'      => 'Rulindo',
                'address'   => 'Base, Rulindo, Northern Province',
                'latitude'  => -1.7340,
                'longitude' => 29.8747,
            ],
        ];

        foreach ($terminals as $terminal) {
            Location::create($terminal);
        }

        $this->command->info('LocationsSeeder: ' . count($terminals) . ' terminals seeded.');
    }
}
