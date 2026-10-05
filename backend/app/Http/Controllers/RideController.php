<?php

namespace App\Http\Controllers;

use App\Models\Vehicle;
use App\Services\Rides\NearbyDrivers;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Rider side of on-demand rides.
 */
class RideController extends Controller
{
    /** GET /rides/nearby — story S3.2 */
    public function nearby(Request $request, NearbyDrivers $nearby)
    {
        $validated = $request->validate([
            'lat'      => 'required|numeric|between:-90,90',
            'lng'      => 'required|numeric|between:-180,180',
            'dest_lat' => 'required|numeric|between:-90,90',
            'dest_lng' => 'required|numeric|between:-180,180',
            'class'    => ['sometimes', 'nullable', Rule::in(Vehicle::CLASSES)],
        ]);

        return response()->json($nearby->search(
            (float) $validated['lat'], (float) $validated['lng'],
            (float) $validated['dest_lat'], (float) $validated['dest_lng'],
            $validated['class'] ?? null,
            $request->user()->id,
        ));
    }
}
