<?php

namespace App\Modules\NearbyRides\Application;

use App\Models\DriverRate;
use App\Modules\Pricing\Contracts\PricingPolicy;
use App\Modules\Pricing\Contracts\ProviderRateRevalidator;
use App\Modules\Notifications\Contracts\PushSender;

/**
 * Keeps driver-set ride rates inside the superadmin guardrails (RIDE_HAILING_PLAN.md §3.3).
 * Ride-only: hire prices have their own limits (DriverHire HireQuote::rateRules). Pricing
 * calls revalidateProviderRates() right after the guardrails are saved.
 */
class RateGuardrails implements ProviderRateRevalidator
{
    public function __construct(private PushSender $push)
    {
    }

    public function revalidateProviderRates(): int
    {
        return self::flagOutOfBand($this->push);
    }

    /** Laravel validation rules for ride rates on a vehicle of this class. */
    public static function rules(string $vehicleClass): array
    {
        $g = app(PricingPolicy::class)->vehicleClassLimits($vehicleClass);

        return [
            'base_fare'        => 'required|integer|min:0|max:100000',
            'per_km'           => "required|integer|min:{$g['per_km_min']}|max:{$g['per_km_max']}",
            'per_min'          => 'sometimes|integer|min:0|max:1000',
            'min_fare'         => "required|integer|min:0|max:{$g['min_fare_max']}",
            'pickup_free_km'   => 'sometimes|numeric|min:0|max:20',
            'pickup_per_km'    => "sometimes|integer|min:0|max:{$g['per_km_max']}",
            'night_multiplier' => 'sometimes|numeric|min:1|max:2',
        ];
    }

    public static function messages(string $vehicleClass): array
    {
        $g = app(PricingPolicy::class)->vehicleClassLimits($vehicleClass);

        return [
            'per_km.min' => "Price per km for this vehicle must be between {$g['per_km_min']} and {$g['per_km_max']} RWF.",
            'per_km.max' => "Price per km for this vehicle must be between {$g['per_km_min']} and {$g['per_km_max']} RWF.",
            'min_fare.max' => "Minimum fare for this vehicle can be at most {$g['min_fare_max']} RWF.",
        ];
    }

    public static function isWithin(DriverRate $rate, string $vehicleClass): bool
    {
        $g = app(PricingPolicy::class)->vehicleClassLimits($vehicleClass);

        return $rate->per_km >= $g['per_km_min']
            && $rate->per_km <= $g['per_km_max']
            && $rate->min_fare <= $g['min_fare_max'];
    }

    /**
     * After guardrails change: mark ride rates that no longer fit and notify those drivers
     * once; clear the mark on rates that fit again. Returns how many were newly flagged.
     */
    public static function flagOutOfBand(PushSender $push): int
    {
        $flagged = 0;
        DriverRate::with('vehicle', 'driver')->where('service', 'ride')->where('is_active', true)
            ->chunkById(200, function ($rates) use ($push, &$flagged) {
                foreach ($rates as $rate) {
                    $within = self::isWithin($rate, $rate->vehicle->class ?? 'car');
                    if (!$within && !$rate->out_of_band_at) {
                        $rate->update(['out_of_band_at' => now()]);
                        $flagged++;
                        $push->send(
                            $rate->driver,
                            'Please update your prices',
                            'Jali price limits changed and your current rates are outside them.',
                            ['screen' => 'driver_rates'],
                        );
                    } elseif ($within && $rate->out_of_band_at) {
                        $rate->update(['out_of_band_at' => null]);
                    }
                }
            });

        return $flagged;
    }
}
