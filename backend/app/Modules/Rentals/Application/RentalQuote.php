<?php

namespace App\Modules\Rentals\Application;

use App\Models\CarRental;
use Carbon\CarbonInterface;

/**
 * Rental price for a date range (story S24.3). Prices are the owner's: Jali adds
 * no fee (release plan, zero Jali fees). The deposit is shown apart and paid back
 * at return, so it is not in the total.
 */
class RentalQuote
{
    /** Started 24-hour periods, at least one */
    public static function days(CarbonInterface $start, CarbonInterface $end): int
    {
        return max(1, (int) ceil($start->diffInMinutes($end) / 1440));
    }

    public static function quote(CarRental $car, CarbonInterface $start, CarbonInterface $end, bool $delivery = false): array
    {
        $days = self::days($start, $end);
        $base = (int) $car->price * $days;
        $pct = $days >= 28 && $car->monthly_discount_pct ? (int) $car->monthly_discount_pct
            : ($days >= 7 ? (int) $car->weekly_discount_pct : 0);
        $discount = (int) round($base * $pct / 100);
        $deliveryFee = $delivery && $car->delivery_available ? (int) $car->delivery_fee : 0;

        return [
            'currency'      => 'RWF',
            'price_per_day' => (int) $car->price,
            'days'          => $days,
            'base'          => $base,
            'discount_pct'  => $pct,
            'discount'      => $discount,
            'delivery_fee'  => $deliveryFee,
            'jali_fee'      => 0,
            'total'         => $base - $discount + $deliveryFee,
            'deposit'       => (int) $car->caution,
        ];
    }

    /** Rules and policies the customer agrees to, locked on the booking */
    public static function terms(CarRental $car): array
    {
        return [
            'mileage_limit_km'    => $car->mileage_limit_km,
            'extra_km_fee'        => (int) $car->extra_km_fee,
            'fuel_policy'         => $car->fuel_policy,
            'min_driver_age'      => (int) $car->min_driver_age,
            'min_licence_years'   => (int) $car->min_licence_years,
            'cancellation_policy' => $car->cancellation_policy,
            'allowed'             => RentalCarForm::allowed($car->allowed),
            'rules'               => array_values((array) $car->rules),
        ];
    }
}
