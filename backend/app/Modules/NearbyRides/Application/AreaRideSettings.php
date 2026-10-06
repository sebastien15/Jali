<?php

namespace App\Modules\NearbyRides\Application;

use App\Models\DriverRate;
use App\Modules\Locations\Contracts\ServiceAreas;
use App\Modules\Pricing\Contracts\PricingPolicy;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Ride settings at a pickup point (S10.4): the global settings with the
 * city's overrides applied, and the check that rides are offered there.
 */
class AreaRideSettings
{
    public const OVERRIDABLE = ['commission_pct', 'cancel_fee', 'free_wait_min', 'nearby_radius_km', 'broadcast_max_drivers', 'vehicle_classes'];

    public function __construct(private PricingPolicy $pricing, private ServiceAreas $areas)
    {
    }

    public function at(float $lat, float $lng): array
    {
        $settings = $this->pricing->settings();
        $city = $this->areas->cityAt($lat, $lng);
        if (!$city) {
            return $settings;
        }

        return array_replace_recursive($settings, array_intersect_key($city['overrides'] ?? [], array_flip(self::OVERRIDABLE)));
    }

    /** 422 "Not available here yet" when the pickup is outside every active city, or rides are off there. */
    public function assertServed(float $lat, float $lng, string $service = 'rides'): void
    {
        $check = $this->areas->availability($lat, $lng, $service);
        if (!$check['served']) {
            throw new HttpException(422, $check['message']);
        }
    }

    /** Whether a driver's rate fits this city's guardrails for the vehicle class. */
    public static function rateFits(array $settings, DriverRate $rate, string $class): bool
    {
        $g = $settings['vehicle_classes'][$class] ?? $settings['vehicle_classes']['car'];

        return $rate->per_km >= $g['per_km_min'] && $rate->per_km <= $g['per_km_max'] && $rate->min_fare <= $g['min_fare_max'];
    }
}
