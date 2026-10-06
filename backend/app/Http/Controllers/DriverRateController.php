<?php

namespace App\Http\Controllers;

use App\Modules\NearbyRides\Application\DriverRates;
use App\Modules\NearbyRides\Application\RateGuardrails;
use Illuminate\Http\Request;

/**
 * Drivers set their own ride prices for their active vehicle (story S2.1).
 * Transport adapter for NearbyRides (runbook M03-Rides): validation + HTTP shape only.
 */
class DriverRateController extends Controller
{
    public function __construct(private readonly DriverRates $rates)
    {
    }

    /** GET /driver/rates */
    public function show(Request $request)
    {
        return response()->json($this->rates->show($request->user()));
    }

    /** PUT /driver/rates */
    public function update(Request $request)
    {
        $user = $request->user();
        $vehicle = $this->rates->activeVehicle($user);
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

        return response()->json($this->rates->save($user, $vehicle, $validated));
    }
}
