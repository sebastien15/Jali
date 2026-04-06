<?php

namespace Database\Seeders;

use App\Models\Bus;
use Illuminate\Database\Seeder;

class BusesSeeder extends Seeder
{
    public function run(): void
    {
        $buses = [
            // Kigali → Musanze
            ['agency' => 'Volcano Express', 'from' => 'Kigali', 'to' => 'Musanze', 'dep' => '06:00', 'arr' => '08:30', 'price' => 3000, 'seats' => 60, 'rating' => 4.8, 'active' => true],
            ['agency' => 'RITCO', 'from' => 'Kigali', 'to' => 'Musanze', 'dep' => '07:00', 'arr' => '09:30', 'price' => 2500, 'seats' => 50, 'rating' => 4.5, 'active' => true],
            ['agency' => 'Volcano Express', 'from' => 'Kigali', 'to' => 'Musanze', 'dep' => '09:00', 'arr' => '11:30', 'price' => 3000, 'seats' => 60, 'rating' => 4.8, 'active' => true],
            ['agency' => 'RITCO', 'from' => 'Kigali', 'to' => 'Musanze', 'dep' => '12:00', 'arr' => '14:30', 'price' => 2500, 'seats' => 50, 'rating' => 4.5, 'active' => true],
            ['agency' => 'Volcano Express', 'from' => 'Kigali', 'to' => 'Musanze', 'dep' => '15:00', 'arr' => '17:30', 'price' => 3000, 'seats' => 60, 'rating' => 4.8, 'active' => true],

            // Musanze → Kigali
            ['agency' => 'Volcano Express', 'from' => 'Musanze', 'to' => 'Kigali', 'dep' => '06:00', 'arr' => '08:30', 'price' => 3000, 'seats' => 60, 'rating' => 4.8, 'active' => true],
            ['agency' => 'RITCO', 'from' => 'Musanze', 'to' => 'Kigali', 'dep' => '08:00', 'arr' => '10:30', 'price' => 2500, 'seats' => 50, 'rating' => 4.5, 'active' => true],
            ['agency' => 'Volcano Express', 'from' => 'Musanze', 'to' => 'Kigali', 'dep' => '14:00', 'arr' => '16:30', 'price' => 3000, 'seats' => 60, 'rating' => 4.8, 'active' => true],

            // Kigali → Huye
            ['agency' => 'RITCO', 'from' => 'Kigali', 'to' => 'Huye', 'dep' => '07:00', 'arr' => '09:30', 'price' => 2500, 'seats' => 50, 'rating' => 4.3, 'active' => true],
            ['agency' => 'Volcano Express', 'from' => 'Kigali', 'to' => 'Huye', 'dep' => '08:00', 'arr' => '10:30', 'price' => 3000, 'seats' => 60, 'rating' => 4.6, 'active' => true],
            ['agency' => 'RITCO', 'from' => 'Kigali', 'to' => 'Huye', 'dep' => '13:00', 'arr' => '15:30', 'price' => 2500, 'seats' => 50, 'rating' => 4.3, 'active' => true],

            // Huye → Kigali
            ['agency' => 'RITCO', 'from' => 'Huye', 'to' => 'Kigali', 'dep' => '06:30', 'arr' => '09:00', 'price' => 2500, 'seats' => 50, 'rating' => 4.3, 'active' => true],
            ['agency' => 'Volcano Express', 'from' => 'Huye', 'to' => 'Kigali', 'dep' => '10:00', 'arr' => '12:30', 'price' => 3000, 'seats' => 60, 'rating' => 4.6, 'active' => true],

            // Kigali → Rubavu
            ['agency' => 'RITCO', 'from' => 'Kigali', 'to' => 'Rubavu', 'dep' => '07:00', 'arr' => '11:00', 'price' => 4000, 'seats' => 50, 'rating' => 4.4, 'active' => true],
            ['agency' => 'Volcano Express', 'from' => 'Kigali', 'to' => 'Rubavu', 'dep' => '08:00', 'arr' => '12:00', 'price' => 4500, 'seats' => 60, 'rating' => 4.7, 'active' => true],

            // Rubavu → Kigali
            ['agency' => 'RITCO', 'from' => 'Rubavu', 'to' => 'Kigali', 'dep' => '06:00', 'arr' => '10:00', 'price' => 4000, 'seats' => 50, 'rating' => 4.4, 'active' => true],
            ['agency' => 'Volcano Express', 'from' => 'Rubavu', 'to' => 'Kigali', 'dep' => '07:00', 'arr' => '11:00', 'price' => 4500, 'seats' => 60, 'rating' => 4.7, 'active' => true],

            // Kigali → Nyagatare
            ['agency' => 'RITCO', 'from' => 'Kigali', 'to' => 'Nyagatare', 'dep' => '06:30', 'arr' => '09:30', 'price' => 2000, 'seats' => 50, 'rating' => 4.2, 'active' => true],
            ['agency' => 'RITCO', 'from' => 'Kigali', 'to' => 'Nyagatare', 'dep' => '14:00', 'arr' => '17:00', 'price' => 2000, 'seats' => 50, 'rating' => 4.2, 'active' => true],

            // Kigali → Rusizi
            ['agency' => 'Volcano Express', 'from' => 'Kigali', 'to' => 'Rusizi', 'dep' => '06:00', 'arr' => '11:00', 'price' => 5000, 'seats' => 60, 'rating' => 4.5, 'active' => true],
        ];

        foreach ($buses as $bus) {
            Bus::create($bus);
        }
    }
}
