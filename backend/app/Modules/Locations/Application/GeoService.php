<?php

namespace App\Modules\Locations\Application;

use App\Modules\Pricing\Contracts\PricingPolicy;

/**
 * Distances for pricing and nearby search. Phase 1 uses straight-line
 * (haversine) distance × road factor; S11.1 swaps in a routing engine.
 */
class GeoService
{
    private const EARTH_RADIUS_KM = 6371.0;

    public static function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $h = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return self::EARTH_RADIUS_KM * 2 * asin(min(1.0, sqrt($h)));
    }

    /** Estimated road distance in km, rounded to 0.1 km. */
    public static function roadKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $factor = (float) app(PricingPolicy::class)->settings()['road_factor'];

        return round(self::haversineKm($lat1, $lng1, $lat2, $lng2) * $factor, 1);
    }
}
