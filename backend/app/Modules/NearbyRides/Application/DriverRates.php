<?php

namespace App\Modules\NearbyRides\Application;

use App\Models\DriverRate;
use App\Models\User;
use App\Models\Vehicle;
use App\Modules\Pricing\Contracts\PricingPolicy;
use Carbon\CarbonImmutable;

/**
 * A driver's own ride prices for their active vehicle (story S2.1). Rates are
 * snapshotted on each ride when requested (S2.3), so saving here never changes
 * rides that were already quoted. Input is validated by the transport adapter
 * against RateGuardrails::rules()/messages().
 */
class DriverRates
{
    private const PREVIEW_KM = [2, 5, 10];

    public function __construct(private FareService $fares, private PricingPolicy $pricing)
    {
    }

    public function activeVehicle(User $user): ?Vehicle
    {
        return $user->vehicles()->where('is_active', true)->first();
    }

    /** GET /driver/rates */
    public function show(User $user): array
    {
        $vehicle = $this->activeVehicle($user);
        $rate = $vehicle ? DriverRate::where([
            'user_id' => $user->id, 'vehicle_id' => $vehicle->id, 'service' => 'ride',
        ])->first() : null;

        return $this->payload($vehicle, $rate);
    }

    /** PUT /driver/rates — saving clears any out-of-band flag */
    public function save(User $user, Vehicle $vehicle, array $validated): array
    {
        $rate = DriverRate::updateOrCreate(
            ['user_id' => $user->id, 'vehicle_id' => $vehicle->id, 'service' => 'ride'],
            $validated + ['is_active' => true, 'out_of_band_at' => null],
        );

        return $this->payload($vehicle, $rate->fresh());
    }

    private function payload(?Vehicle $vehicle, ?DriverRate $rate): array
    {
        $settings = $this->pricing->settings();
        $class = $vehicle?->class ?? 'car';
        $day = CarbonImmutable::parse('today 14:00', FareService::TIMEZONE);

        return [
            'vehicle'       => $vehicle ? ['id' => $vehicle->id, 'class' => $class, 'model' => $vehicle->model, 'plate' => $vehicle->plate] : null,
            'rates'         => $rate ? ['vehicle_id' => $vehicle->id] + $rate->fareSnapshot() : null,
            'out_of_band'   => (bool) $rate?->out_of_band_at,
            'guardrails'    => $this->pricing->vehicleClassLimits($class),
            'service_fee'   => $settings['service_fee'],
            'commission_pct'=> $settings['commission_pct'],
            'preview'       => $rate ? array_map(fn ($km) => ['km' => $km] + array_intersect_key(
                $this->fares->quote($rate->fareSnapshot(), $km, 0, 0, $day),
                array_flip(['driver_fare', 'service_fee', 'total']),
            ), self::PREVIEW_KM) : [],
        ];
    }
}
