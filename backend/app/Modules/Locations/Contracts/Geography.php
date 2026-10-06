<?php

namespace App\Modules\Locations\Contracts;

/**
 * Distances and place labels for services that price or show trips (rides
 * today). Phase 1 is straight-line distance × road factor; a routing engine
 * (S11.1) can replace it behind this port without changing callers.
 */
interface Geography
{
    /** Great-circle distance in km. */
    public function straightKm(float $lat1, float $lng1, float $lat2, float $lng2): float;

    /** Estimated road distance in km, rounded to 0.1 km. */
    public function roadDistanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float;

    /** "KN 3 Rd, Kiyovu, Nyarugenge, Kigali, Rwanda" → "KN 3 Rd, Kiyovu, Nyarugenge" */
    public function shortPlaceName(string $displayName): string;
}
