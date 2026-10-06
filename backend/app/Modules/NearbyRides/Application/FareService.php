<?php

namespace App\Modules\NearbyRides\Application;

use App\Modules\Pricing\Contracts\PricingPolicy;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Computes what a rider pays from a driver's own rates (RIDE_HAILING_PLAN.md §3.2).
 * The server is the only source of truth for prices; the app's preview mirrors this.
 *
 *   fare = max(min_fare, base + per_km·trip_km + per_min·minutes + max(0, pickup_km − free_km)·pickup_per_km)
 *   fare ×= night_multiplier between 22:00 and 05:00 (Africa/Kigali)
 *   driver_fare = fare rounded up to the next 100 RWF
 *   total = driver_fare + Jali service fee
 */
class FareService
{
    public const TIMEZONE = 'Africa/Kigali';
    public const NIGHT_START = 22;
    public const NIGHT_END = 5;

    /**
     * @param array $rates keys of DriverRate::FARE_FIELDS
     * @return array{driver_fare: int, service_fee: int, total: int, is_night: bool}
     */
    public function quote(array $rates, float $tripKm, float $pickupKm = 0, float $minutes = 0, ?CarbonInterface $at = null): array
    {
        $fare = ($rates['base_fare'] ?? 0)
            + ($rates['per_km'] ?? 0) * $tripKm
            + ($rates['per_min'] ?? 0) * $minutes
            + max(0, $pickupKm - ($rates['pickup_free_km'] ?? 0)) * ($rates['pickup_per_km'] ?? 0);

        $fare = max((float) ($rates['min_fare'] ?? 0), $fare);

        $isNight = self::isNight($at ?? CarbonImmutable::now());
        if ($isNight) {
            $fare *= (float) ($rates['night_multiplier'] ?? 1);
        }

        $driverFare = self::roundUpTo100($fare);
        $serviceFee = self::serviceFee($driverFare);

        return [
            'driver_fare' => $driverFare,
            'service_fee' => $serviceFee,
            'total'       => $driverFare + $serviceFee,
            'is_night'    => $isNight,
        ];
    }

    public static function isNight(CarbonInterface $at): bool
    {
        $hour = (int) $at->copy()->setTimezone(self::TIMEZONE)->format('G');

        return $hour >= self::NIGHT_START || $hour < self::NIGHT_END;
    }

    public static function roundUpTo100(float $amount): int
    {
        // Small epsilon so float noise (e.g. 2000.0000001) doesn't add 100 RWF
        return (int) (ceil(($amount - 1e-6) / 100) * 100);
    }

    public static function serviceFee(int $driverFare): int
    {
        $fee = app(PricingPolicy::class)->settings()['service_fee'];

        return $fee['type'] === 'percent'
            ? (int) round($driverFare * (float) $fee['amount'] / 100)
            : (int) $fee['amount'];
    }
}
