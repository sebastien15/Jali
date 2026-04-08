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
            ['driver' => 'Joseph Ndayisaba',  'from' => 'Kigali',  'to' => 'Musanze',   'pickup_station' => 'Nyabugogo Terminal', 'dep' => now()->addDays(1)->format('Y-m-d') . ' 06:00', 'date' => now()->addDays(1)->format('Y-m-d'), 'price' => 2000, 'seats' => 3, 'rating' => 4.5, 'active' => true, 'amenities' => ['AC', 'Music System']],
            ['driver' => 'Claudine Nyiramana','from' => 'Kigali',  'to' => 'Musanze',   'pickup_station' => 'Nyabugogo Terminal', 'dep' => now()->addDays(1)->format('Y-m-d') . ' 08:00', 'date' => now()->addDays(1)->format('Y-m-d'), 'price' => 2000, 'seats' => 2, 'rating' => 4.7, 'active' => true, 'amenities' => ['AC', 'USB Charging']],

            // Musanze → Kigali
            ['driver' => 'Pierre Hakizimana', 'from' => 'Musanze', 'to' => 'Kigali',   'pickup_station' => 'Musanze Bus Terminal', 'dep' => now()->addDays(1)->format('Y-m-d') . ' 14:00', 'date' => now()->addDays(1)->format('Y-m-d'), 'price' => 2000, 'seats' => 3, 'rating' => 4.3, 'active' => true, 'amenities' => ['AC']],

            // Kigali → Huye
            ['driver' => 'Joseph Ndayisaba',  'from' => 'Kigali',  'to' => 'Huye',     'pickup_station' => 'Nyabugogo Terminal', 'dep' => now()->addDays(2)->format('Y-m-d') . ' 07:00', 'date' => now()->addDays(2)->format('Y-m-d'), 'price' => 1500, 'seats' => 3, 'rating' => 4.5, 'active' => true, 'amenities' => ['AC', 'Large Boot']],

            // Huye → Kigali
            ['driver' => 'Claudine Nyiramana','from' => 'Huye',    'to' => 'Kigali',   'pickup_station' => 'Huye Bus Terminal',   'dep' => now()->addDays(2)->format('Y-m-d') . ' 15:00', 'date' => now()->addDays(2)->format('Y-m-d'), 'price' => 1500, 'seats' => 2, 'rating' => 4.7, 'active' => true, 'amenities' => ['AC', 'Music System']],

            // Kigali → Rubavu
            ['driver' => 'Pierre Hakizimana', 'from' => 'Kigali',  'to' => 'Rubavu',   'pickup_station' => 'Nyabugogo Terminal', 'dep' => now()->addDays(3)->format('Y-m-d') . ' 06:00', 'date' => now()->addDays(3)->format('Y-m-d'), 'price' => 3000, 'seats' => 3, 'rating' => 4.3, 'active' => true, 'amenities' => ['AC']],

            // Kigali → Rwamagana
            ['driver' => 'Joseph Ndayisaba',  'from' => 'Kigali',  'to' => 'Rwamagana','pickup_station' => 'Remera Stage',        'dep' => now()->addDays(1)->format('Y-m-d') . ' 09:00', 'date' => now()->addDays(1)->format('Y-m-d'), 'price' => 1000, 'seats' => 3, 'rating' => 4.5, 'active' => true, 'amenities' => []],
        ];

        foreach ($seats as $seat) {
            PrivateSeat::create($seat);
        }
    }
}
