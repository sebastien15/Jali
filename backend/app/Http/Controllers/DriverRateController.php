<?php

namespace App\Http\Controllers;

use App\Models\DriverRate;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\Rides\FareService;
use App\Services\Rides\RateGuardrails;
use App\Services\Rides\RideSettings;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/**
 * Drivers set their own ride prices for their active vehicle (story S2.1).
 */
class DriverRateController extends Controller
{
    private const PREVIEW_KM = [2, 5, 10];

    /** GET /driver/rates */
    public function show(Request $request, FareService $fares)
    {
        $user = $request->user();
        $vehicle = $this->activeVehicle($user);
        $rate = $vehicle ? $this->rateFor($user, $vehicle) : null;

        return response()->json($this->payload($vehicle, $rate, $fares));
    }

    /** PUT /driver/rates */
    public function update(Request $request, FareService $fares)
    {
        $user = $request->user();
        $vehicle = $this->activeVehicle($user);
        if (!$vehicle) {
            return response()->json([
                'message' => 'Add your vehicle in My Setup before setting prices.',
                'errors'  => ['vehicle' => ['Add your vehicle in My Setup before setting prices.']],
            ], 422);
        }

        $validated = $request->validate(
            RateGuardrails::rules($vehicle->class),
            RateGuardrails::messages($vehicle->class),
        );

        // Rates are snapshotted on each ride when requested (S2.3), so changing them
        // here never affects rides that were already quoted.
        $rate = DriverRate::updateOrCreate(
            ['user_id' => $user->id, 'vehicle_id' => $vehicle->id, 'service' => 'ride'],
            $validated + ['is_active' => true, 'out_of_band_at' => null],
        );

        return response()->json($this->payload($vehicle, $rate->fresh(), $fares));
    }

    private function activeVehicle(User $user): ?Vehicle
    {
        return $user->vehicles()->where('is_active', true)->first();
    }

    private function rateFor(User $user, Vehicle $vehicle): ?DriverRate
    {
        return DriverRate::where([
            'user_id' => $user->id, 'vehicle_id' => $vehicle->id, 'service' => 'ride',
        ])->first();
    }

    private function payload(?Vehicle $vehicle, ?DriverRate $rate, FareService $fares): array
    {
        $settings = RideSettings::get();
        $class = $vehicle?->class ?? 'car';
        $day = CarbonImmutable::parse('today 14:00', FareService::TIMEZONE);

        return [
            'vehicle'       => $vehicle ? ['id' => $vehicle->id, 'class' => $class, 'model' => $vehicle->model, 'plate' => $vehicle->plate] : null,
            'rates'         => $rate ? ['vehicle_id' => $vehicle->id] + $rate->fareSnapshot() : null,
            'out_of_band'   => (bool) $rate?->out_of_band_at,
            'guardrails'    => RideSettings::forClass($class),
            'service_fee'   => $settings['service_fee'],
            'commission_pct'=> $settings['commission_pct'],
            'preview'       => $rate ? array_map(fn ($km) => ['km' => $km] + array_intersect_key(
                $fares->quote($rate->fareSnapshot(), $km, 0, 0, $day),
                array_flip(['driver_fare', 'service_fee', 'total']),
            ), self::PREVIEW_KM) : [],
        ];
    }
}
