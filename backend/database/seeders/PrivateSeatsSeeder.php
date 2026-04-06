<?php

namespace Database\Seeders;

use App\Models\PrivateSeat;
use Illuminate\Database\Seeder;

class PrivateSeatsSeeder extends Seeder
{
    public function run(): void
    {
        $seats = [
            // Kigali → Musanze
            ['driver' => 'Joseph Ndayisaba', 'from' => 'Kigali', 'to' => 'Musanze', 'dep' => '2025-04-10 06:00', 'price' => 2000, 'seats' => 3, 'rating' => 4.5],
            ['driver' => 'Claudine Nyiramana', 'from' => 'Kigali', 'to' => 'Musanze', 'dep' => '2025-04-10 08:00', 'price' => 2000, 'seats' => 2, 'rating' => 4.7],

            // Musanze → Kigali
            ['driver' => 'Pierre Hakizimana', 'from' => 'Musanze', 'to' => 'Kigali', 'dep' => '2025-04-10 14:00', 'price' => 2000, 'seats' => 3, 'rating' => 4.3],

            // Kigali → Huye
            ['driver' => 'Joseph Ndayisaba', 'from' => 'Kigali', 'to' => 'Huye', 'dep' => '2025-04-11 07:00', 'price' => 1500, 'seats' => 3, 'rating' => 4.5],

            // Huye → Kigali
            ['driver' => 'Claudine Nyiramana', 'from' => 'Huye', 'to' => 'Kigali', 'dep' => '2025-04-11 15:00', 'price' => 1500, 'seats' => 2, 'rating' => 4.7],

            // Kigali → Rubavu
            ['driver' => 'Pierre Hakizimana', 'from' => 'Kigali', 'to' => 'Rubavu', 'dep' => '2025-04-12 06:00', 'price' => 3000, 'seats' => 3, 'rating' => 4.3],

            // Kigali → Rwamagana
            ['driver' => 'Joseph Ndayisaba', 'from' => 'Kigali', 'to' => 'Rwamagana', 'dep' => '2025-04-10 09:00', 'price' => 1000, 'seats' => 3, 'rating' => 4.5],
        ];

        foreach ($seats as $seat) {
            PrivateSeat::create($seat);
        }
    }
}
