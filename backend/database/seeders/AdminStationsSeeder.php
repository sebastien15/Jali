<?php

namespace Database\Seeders;

use App\Models\AdminStation;
use App\Models\User;
use Illuminate\Database\Seeder;

class AdminStationsSeeder extends Seeder
{
    public function run(): void
    {
        // Get admin users by their firebase_uid patterns
        $adminKigali = User::where('firebase_uid', 'admin_kigali_uid')->first();
        $adminMusanze = User::where('firebase_uid', 'admin_musanze_uid')->first();
        $adminHuye = User::where('firebase_uid', 'admin_huye_uid')->first();

        if ($adminKigali) {
            AdminStation::create([
                'user_id' => $adminKigali->id,
                'city' => 'Kigali',
            ]);
        }

        if ($adminMusanze) {
            AdminStation::create([
                'user_id' => $adminMusanze->id,
                'city' => 'Musanze',
            ]);
        }

        if ($adminHuye) {
            AdminStation::create([
                'user_id' => $adminHuye->id,
                'city' => 'Huye',
            ]);
        }
    }
}
