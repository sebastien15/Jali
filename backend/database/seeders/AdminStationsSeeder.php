<?php

namespace Database\Seeders;

use App\Models\AdminStation;
use App\Models\User;
use Illuminate\Database\Seeder;

class AdminStationsSeeder extends Seeder
{
    public function run(): void
    {
        // AdminSeeder already creates stations for seeded admin users.
        // This seeder exists as a safety fallback using email lookups.
        $assignments = [
            'admin.kigali@jali.rw'  => 'Kigali',
            'admin.musanze@jali.rw' => 'Musanze',
            'admin.huye@jali.rw'    => 'Huye',
        ];

        foreach ($assignments as $email => $city) {
            $admin = User::where('email', $email)->first();
            if ($admin) {
                AdminStation::firstOrCreate(
                    ['user_id' => $admin->id],
                    ['city' => $city]
                );
            }
        }
    }
}
