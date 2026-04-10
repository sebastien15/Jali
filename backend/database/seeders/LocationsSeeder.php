<?php

namespace Database\Seeders;

use App\Models\Location;
use Illuminate\Database\Seeder;

class LocationsSeeder extends Seeder
{
    public function run(): void
    {
        $locations = [
            [
                "name" => "Kigali",
                "type" => "bus_station",
                "city" => "Kigali",
                "address" => "Nyabugogo Bus Park, Kigali",
            ],
            [
                "name" => "Musanze",
                "type" => "bus_station",
                "city" => "Musanze",
                "address" => "Musanze Bus Station",
            ],
            [
                "name" => "Huye",
                "type" => "bus_station",
                "city" => "Huye",
                "address" => "Huye Bus Station",
            ],
            [
                "name" => "Rubavu",
                "type" => "bus_station",
                "city" => "Rubavu",
                "address" => "Gisenyi Bus Station, Rubavu",
            ],
            [
                "name" => "Nyagatare",
                "type" => "bus_station",
                "city" => "Nyagatare",
                "address" => "Nyagatare Bus Station",
            ],
            [
                "name" => "Rwamagana",
                "type" => "bus_station",
                "city" => "Rwamagana",
                "address" => "Rwamagana Bus Station",
            ],
            [
                "name" => "Muhanga",
                "type" => "bus_station",
                "city" => "Muhanga",
                "address" => "Muhanga Bus Station",
            ],
            [
                "name" => "Rusizi",
                "type" => "bus_station",
                "city" => "Rusizi",
                "address" => "Kamembe Bus Station, Rusizi",
            ],
        ];

        foreach ($locations as $loc) {
            Location::firstOrCreate(
                ["city" => $loc["city"], "type" => $loc["type"]],
                $loc,
            );
        }
    }
}
