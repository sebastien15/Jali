<?php

namespace App\Http\Controllers;

use App\Models\Vehicle;
use App\Modules\Providers\Application\DriverSetup;
use App\Modules\SharedJourneys\Application\ListingActivity;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Transport adapter for SharedJourneys (stats/trips) and Providers (setup profile): validation + HTTP shape only. */
class DriverController extends Controller
{
    /**
     * GET /driver/stats
     * Returns today's and this week's earnings + trip counts for the authenticated driver.
     * Private-seat listings only (SharedJourneys).
     */
    public function stats(Request $request, ListingActivity $activity)
    {
        return response()->json($activity->stats($request->user()));
    }

    /**
     * GET /driver/trips
     * Returns bookings made on the driver's listings, shaped for the Drive dashboard.
     * Private-seat listings only (SharedJourneys).
     */
    public function trips(Request $request, ListingActivity $activity)
    {
        return response()->json($activity->trips($request->user()));
    }

    /**
     * GET /driver/profile
     * Driver profile, active vehicle and all vehicles of the authenticated user.
     */
    public function profile(Request $request, DriverSetup $setup)
    {
        return response()->json($setup->payload($request->user()));
    }

    /**
     * PATCH /driver/profile
     * Saves what driver/setup.tsx collects: display name, FCM token, operating zones,
     * documents link and the active vehicle (created on first save).
     */
    public function updateProfile(Request $request, DriverSetup $setup)
    {
        $user = $request->user();
        $vehicle = $setup->activeVehicle($user);

        if ($request->filled('plate')) {
            $request->merge(['plate' => Vehicle::normalizePlate($request->input('plate'))]);
        }

        $validated = $request->validate([
            'name'             => 'sometimes|string|max:255',
            'fcm_token'        => 'sometimes|string',
            'services'         => 'sometimes|array',
            'services.*'       => 'string|distinct|in:ride,hire,private_seat,rental',
            'allowed_zones'    => 'sometimes|array',
            'allowed_zones.*'  => 'string|max:100',
            'docs_url'         => 'sometimes|nullable|url|max:2048',
            // Vehicle — model and plate are required together the first time a vehicle is saved
            'car_model'        => [$vehicle ? 'sometimes' : 'required_with:plate', 'string', 'max:100'],
            'plate'            => [$vehicle ? 'sometimes' : 'required_with:car_model', 'string', 'max:20',
                                   Rule::unique('vehicles', 'plate')->ignore($vehicle?->id)],
            'car_type'         => 'sometimes|string|in:Sedan,SUV,Minivan,Pickup',
            'seats'            => 'sometimes|integer|min:1|max:60',
            'amenities'        => 'sometimes|array',
            'amenities.*'      => 'string|max:50',
            'insurance_expiry' => 'sometimes|nullable|date_format:Y-m-d',
            'price_day'        => 'sometimes|nullable|integer|min:0',
            'caution'          => 'sometimes|nullable|integer|min:0',
        ], [
            'plate.unique'                 => 'This plate number is already registered on Jali.',
            'insurance_expiry.date_format' => 'Use the format YYYY-MM-DD, e.g. 2026-12-31.',
        ]);

        return response()->json($setup->save($user, $vehicle, $validated));
    }
}
