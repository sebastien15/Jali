<?php

namespace Database\Seeders;

use App\Models\CarRental;
use Illuminate\Database\Seeder;

class CarRentalsSeeder extends Seeder
{
    public function run(): void
    {
        $cars = [
            // SUVs
            ['name' => 'Toyota RAV4', 'type' => 'SUV', 'price' => 50000, 'seats' => 5, 'plate' => 'RAD 123A', 'rating' => 4.7, 'active' => true],
            ['name' => 'Land Cruiser Prado', 'type' => 'SUV', 'price' => 80000, 'seats' => 7, 'plate' => 'RAD 456B', 'rating' => 4.9, 'active' => true],
            ['name' => 'Toyota Fortuner', 'type' => 'SUV', 'price' => 65000, 'seats' => 7, 'plate' => 'RAD 789C', 'rating' => 4.6, 'active' => true],

            // Sedans
            ['name' => 'Toyota Corolla', 'type' => 'Sedan', 'price' => 35000, 'seats' => 5, 'plate' => 'RAD 111D', 'rating' => 4.5, 'active' => true],
            ['name' => 'Hyundai Elantra', 'type' => 'Sedan', 'price' => 30000, 'seats' => 5, 'plate' => 'RAD 222E', 'rating' => 4.3, 'active' => true],
            ['name' => 'Toyota Camry', 'type' => 'Sedan', 'price' => 45000, 'seats' => 5, 'plate' => 'RAD 333F', 'rating' => 4.8, 'active' => true],

            // Minivans
            ['name' => 'Toyota HiAce', 'type' => 'Minivan', 'price' => 70000, 'seats' => 14, 'plate' => 'RAD 444G', 'rating' => 4.4, 'active' => true],
            ['name' => 'Nissan NV350', 'type' => 'Minivan', 'price' => 60000, 'seats' => 12, 'plate' => 'RAD 555H', 'rating' => 4.2, 'active' => true],
        ];

        foreach ($cars as $car) {
            CarRental::create($car);
        }
    }
}
