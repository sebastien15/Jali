<?php

namespace App\Modules\NearbyRides\Application;

use App\Models\DriverPresence;
use App\Models\DriverProfile;
use App\Models\DriverRate;
use App\Models\Ride;
use App\Modules\Locations\Contracts\Geography;
use App\Modules\Pricing\Contracts\PricingPolicy;
use App\Modules\Providers\Contracts\ProviderDisplay;
use Carbon\CarbonInterface;

/**
 * Finds online drivers around a pickup and prices the trip with each
 * driver's own rates (story S3.2, RIDE_HAILING_PLAN.md §4).
 *
 * Phase 1: bounding-box prefilter on indexed lat/lng, exact haversine in PHP.
 * Phase 3 can swap this for Redis GEO without changing the response.
 */
class NearbyDrivers
{
    /** Average city speed used for pickup ETA until real routing (S11.1). */
    public const CITY_KMH = 25;
    public const MAX_RESULTS = 50;

    public function __construct(
        private FareService $fares,
        private PricingPolicy $pricing,
        private Geography $geo,
        private AreaRideSettings $area,
    ) {
    }

    /**
     * @return array<int, array> sorted by ETA, closest first
     */
    public function search(float $lat, float $lng, float $destLat, float $destLng, ?string $class = null,
                           ?int $excludeUserId = null, ?CarbonInterface $at = null): array
    {
        $this->area->assertServed($lat, $lng);
        $settings = $this->area->at($lat, $lng);   // city overrides (S10.4)
        $radiusKm = (float) $settings['nearby_radius_km'];
        $dLat = $radiusKm / 111.0;
        $dLng = $radiusKm / (111.0 * max(0.01, cos(deg2rad($lat))));

        $tripKm = $this->geo->roadDistanceKm($lat, $lng, $destLat, $destLng);
        $tripMinutes = $tripKm / self::CITY_KMH * 60;

        $candidates = DriverPresence::live()
            ->whereBetween('lat', [$lat - $dLat, $lat + $dLat])
            ->whereBetween('lng', [$lng - $dLng, $lng + $dLng])
            ->when($excludeUserId, fn ($q) => $q->where('user_id', '!=', $excludeUserId))
            // Drivers with a pending request or an ongoing ride are busy
            ->whereNotIn('user_id', Ride::whereIn('status', Ride::ACTIVE)->whereNotNull('driver_id')->select('driver_id'))
            ->whereHas('driver.driverProfile', fn ($q) => $q->where('verification_status', DriverProfile::STATUS_VERIFIED))
            ->whereHas('vehicle', fn ($q) => $q->where('is_active', true)->when($class, fn ($q) => $q->where('class', $class)))
            ->with(['driver.driverProfile', 'vehicle'])
            ->limit(500)
            ->get();

        $rates = DriverRate::whereIn('user_id', $candidates->pluck('user_id'))
            ->where(['service' => 'ride', 'is_active' => true])
            ->whereNull('out_of_band_at')
            ->get()
            ->keyBy(fn ($r) => $r->user_id . ':' . $r->vehicle_id);

        $results = [];
        foreach ($candidates as $p) {
            $rate = $rates[$p->user_id . ':' . $p->vehicle_id] ?? null;
            if (!$rate || !AreaRideSettings::rateFits($settings, $rate, $p->vehicle->class)) {
                continue;
            }
            $distance = $this->geo->straightKm($lat, $lng, $p->lat, $p->lng);
            if ($distance > $radiusKm) {
                continue;
            }
            $pickupKm = $this->geo->roadDistanceKm($p->lat, $p->lng, $lat, $lng);
            $quote = $this->fares->quote($rate->fareSnapshot(), $tripKm, $pickupKm, 0, $at);
            $vehicle = $p->vehicle;
            $profile = $p->driver->driverProfile;
            $photos = (array) ($vehicle->photos ?? []);

            $results[] = [
                'driver_id'   => $p->user_id,
                'name'        => self::displayName($p->driver->name),
                'photo'       => self::httpUrl($p->driver->profile_image_url),
                'rating'      => (float) $profile->rating_avg,
                'trips'       => (int) $profile->trips_count,
                'eta_min'     => max(1, (int) ceil($pickupKm / self::CITY_KMH * 60)),
                'distance_km' => round($distance, 1),
                'quote'       => $quote['total'],
                'per_km'      => $rate->per_km,
                'vehicle'     => [
                    'class'     => $vehicle->class,
                    'model'     => trim(($vehicle->make ? $vehicle->make . ' ' : '') . $vehicle->model),
                    'color'     => $vehicle->color,
                    'seats'     => $vehicle->seats,
                    'amenities' => $vehicle->amenities ?? [],
                    'photo'     => $photos['front'] ?? null,
                ],
                // ~100 m precision until a ride is accepted (privacy)
                'approx_location' => ['lat' => round($p->lat, 3), 'lng' => round($p->lng, 3)],
            ];
        }

        usort($results, fn ($a, $b) => [$a['eta_min'], $a['quote']] <=> [$b['eta_min'], $b['quote']]);

        return [
            'trip'    => ['distance_km' => $tripKm, 'est_minutes' => (int) ceil($tripMinutes)],
            'drivers' => array_slice($results, 0, self::MAX_RESULTS),
        ];
    }

    /** "Jean Paul Habimana" → "Jean H." — owned by Providers (ProviderDisplay). */
    public static function displayName(?string $name): string
    {
        return app(ProviderDisplay::class)->displayName($name);
    }

    /** Only plain URLs — some profile images are stored as large data: URIs. */
    private static function httpUrl(?string $url): ?string
    {
        return $url && preg_match('#^https?://#', $url) ? $url : null;
    }
}
