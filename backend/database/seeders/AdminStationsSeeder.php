<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminStationsSeeder extends Seeder
{
    public function run(): void
    {
        // Truncate dependent tables first, then admin_stations
        Schema::disableForeignKeyConstraints();
        DB::table('corridor_terminals')->truncate();
        DB::table('trips')->truncate();
        DB::table('agency_routes')->truncate();
        DB::table('admin_stations')->truncate();
        Schema::enableForeignKeyConstraints();

        $now = now();

        // ── All 16 national bus terminals ──
        // user_id will be set for managed terminals (linked to an admin user).
        // Unmanaged terminals start with user_id = null.
        $terminals = [
            'nyabugogo' => [
                'name'      => 'Nyabugogo Bus Park',
                'city'      => 'Kigali',
                'district'  => 'Gasabo',
                'province'  => 'Kigali City',
                'type'      => 'bus_station',
                'address'   => 'Nyabugogo, Gasabo, Kigali',
                'latitude'  => -1.9407,
                'longitude' => 30.0447,
                'admin_email' => 'admin.kigali@jali.rw',
            ],
            'remera' => [
                'name'      => 'Remera Terminal',
                'city'      => 'Kigali',
                'district'  => 'Gasabo',
                'province'  => 'Kigali City',
                'type'      => 'bus_station',
                'address'   => 'Remera, Gasabo, Kigali',
                'latitude'  => -1.9585,
                'longitude' => 30.1188,
                'admin_email' => null,
            ],
            'rwamagana' => [
                'name'      => 'Rwamagana Terminal',
                'city'      => 'Rwamagana',
                'district'  => 'Rwamagana',
                'province'  => 'Eastern',
                'type'      => 'bus_station',
                'address'   => 'Rwamagana Bus Park, Eastern Province',
                'latitude'  => -1.9525,
                'longitude' => 30.4378,
                'admin_email' => null,
            ],
            'kayonza' => [
                'name'      => 'Kayonza Terminal',
                'city'      => 'Kayonza',
                'district'  => 'Kayonza',
                'province'  => 'Eastern',
                'type'      => 'bus_station',
                'address'   => 'Kayonza Bus Park, Eastern Province',
                'latitude'  => -1.9021,
                'longitude' => 30.5073,
                'admin_email' => null,
            ],
            'nyagatare' => [
                'name'      => 'Nyagatare Terminal',
                'city'      => 'Nyagatare',
                'district'  => 'Nyagatare',
                'province'  => 'Eastern',
                'type'      => 'bus_station',
                'address'   => 'Nyagatare Bus Park, Eastern Province',
                'latitude'  => -1.2931,
                'longitude' => 30.3250,
                'admin_email' => null,
            ],
            'ngoma' => [
                'name'      => 'Ngoma Terminal',
                'city'      => 'Ngoma',
                'district'  => 'Ngoma',
                'province'  => 'Eastern',
                'type'      => 'bus_station',
                'address'   => 'Kibungo, Ngoma, Eastern Province',
                'latitude'  => -2.1491,
                'longitude' => 30.5478,
                'admin_email' => null,
            ],
            'musanze' => [
                'name'      => 'Musanze Terminal',
                'city'      => 'Musanze',
                'district'  => 'Musanze',
                'province'  => 'Northern',
                'type'      => 'bus_station',
                'address'   => 'Musanze Bus Park, Northern Province',
                'latitude'  => -1.4692,
                'longitude' => 29.5817,
                'admin_email' => 'admin.musanze@jali.rw',
            ],
            'gicumbi' => [
                'name'      => 'Gicumbi Terminal',
                'city'      => 'Gicumbi',
                'district'  => 'Gicumbi',
                'province'  => 'Northern',
                'type'      => 'bus_station',
                'address'   => 'Byumba, Gicumbi, Northern Province',
                'latitude'  => -1.5887,
                'longitude' => 30.0551,
                'admin_email' => null,
            ],
            'huye' => [
                'name'      => 'Huye Terminal',
                'city'      => 'Huye',
                'district'  => 'Huye',
                'province'  => 'Southern',
                'type'      => 'bus_station',
                'address'   => 'Butare, Huye, Southern Province',
                'latitude'  => -2.5167,
                'longitude' => 29.7417,
                'admin_email' => 'admin.huye@jali.rw',
            ],
            'muhanga' => [
                'name'      => 'Muhanga Terminal',
                'city'      => 'Muhanga',
                'district'  => 'Muhanga',
                'province'  => 'Southern',
                'type'      => 'bus_station',
                'address'   => 'Gitarama, Muhanga, Southern Province',
                'latitude'  => -2.0831,
                'longitude' => 29.7516,
                'admin_email' => null,
            ],
            'nyanza' => [
                'name'      => 'Nyanza Terminal',
                'city'      => 'Nyanza',
                'district'  => 'Nyanza',
                'province'  => 'Southern',
                'type'      => 'bus_station',
                'address'   => 'Nyanza Bus Park, Southern Province',
                'latitude'  => -2.3514,
                'longitude' => 29.7512,
                'admin_email' => null,
            ],
            'rubavu' => [
                'name'      => 'Rubavu Terminal',
                'city'      => 'Rubavu',
                'district'  => 'Rubavu',
                'province'  => 'Western',
                'type'      => 'bus_station',
                'address'   => 'Gisenyi, Rubavu, Western Province',
                'latitude'  => -1.7000,
                'longitude' => 29.2500,
                'admin_email' => null,
            ],
            'rusizi' => [
                'name'      => 'Rusizi Terminal',
                'city'      => 'Rusizi',
                'district'  => 'Rusizi',
                'province'  => 'Western',
                'type'      => 'bus_station',
                'address'   => 'Kamembe, Rusizi, Western Province',
                'latitude'  => -2.4620,
                'longitude' => 28.9073,
                'admin_email' => null,
            ],
            'karongi' => [
                'name'      => 'Karongi Terminal',
                'city'      => 'Karongi',
                'district'  => 'Karongi',
                'province'  => 'Western',
                'type'      => 'bus_station',
                'address'   => 'Kibuye, Karongi, Western Province',
                'latitude'  => -2.0617,
                'longitude' => 29.3483,
                'admin_email' => null,
            ],
            'nyamata' => [
                'name'      => 'Nyamata Terminal',
                'city'      => 'Nyamata',
                'district'  => 'Bugesera',
                'province'  => 'Eastern',
                'type'      => 'bus_station',
                'address'   => 'Nyamata Bus Park, Bugesera, Eastern Province',
                'latitude'  => -2.1483,
                'longitude' => 30.0907,
                'admin_email' => null,
            ],
            'rulindo' => [
                'name'      => 'Rulindo Terminal',
                'city'      => 'Rulindo',
                'district'  => 'Rulindo',
                'province'  => 'Northern',
                'type'      => 'bus_station',
                'address'   => 'Base, Rulindo, Northern Province',
                'latitude'  => -1.7340,
                'longitude' => 29.8747,
                'admin_email' => null,
            ],
        ];

        foreach ($terminals as $slug => $data) {
            $userId = null;
            if ($data['admin_email']) {
                $admin = User::where('email', $data['admin_email'])->first();
                $userId = $admin?->id;
            }

            DB::table('admin_stations')->insert([
                'user_id'    => $userId,
                'name'       => $data['name'],
                'city'       => $data['city'],
                'district'   => $data['district'],
                'province'   => $data['province'],
                'type'       => $data['type'],
                'address'    => $data['address'],
                'latitude'   => $data['latitude'],
                'longitude'  => $data['longitude'],
                'image_url'  => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $this->command->info('AdminStationsSeeder: ' . count($terminals) . ' terminals seeded.');
    }
}
