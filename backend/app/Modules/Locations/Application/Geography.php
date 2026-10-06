<?php

namespace App\Modules\Locations\Application;

use App\Modules\Locations\Contracts\Geography as GeographyPort;

/** Locations' implementation of its Geography port over GeoService and PlaceSearch. */
class Geography implements GeographyPort
{
    public function straightKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        return GeoService::haversineKm($lat1, $lng1, $lat2, $lng2);
    }

    public function roadDistanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        return GeoService::roadKm($lat1, $lng1, $lat2, $lng2);
    }

    public function shortPlaceName(string $displayName): string
    {
        return PlaceSearch::shortAddress($displayName);
    }
}
