<?php

namespace App\Modules\Rentals\Application;

use App\Models\CarRental;

/** Owner-facing car shape: every column plus `priceDay` (= DB column `price`). */
class RentalCarPresenter
{
    public static function toFrontend(CarRental $car): array
    {
        $data             = $car->toArray();
        $data['priceDay'] = $car->price;
        return $data;
    }
}
