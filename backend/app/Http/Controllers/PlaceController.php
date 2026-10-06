<?php

namespace App\Http\Controllers;

use App\Modules\Locations\Application\PlaceSearch;
use Illuminate\Http\Request;

/** "Where to?" place search (story S3.1) */
class PlaceController extends Controller
{
    /** GET /places/search?q=&lat=&lng= */
    public function search(Request $request, PlaceSearch $places)
    {
        $validated = $request->validate([
            'q'   => 'required|string|min:2|max:120',
            'lat' => 'sometimes|nullable|numeric|between:-90,90',
            'lng' => 'sometimes|nullable|numeric|between:-180,180',
        ]);

        return response()->json($places->search(
            $validated['q'],
            isset($validated['lat']) ? (float) $validated['lat'] : null,
            isset($validated['lng']) ? (float) $validated['lng'] : null,
        ));
    }

    /** GET /places/reverse?lat=&lng= */
    public function reverse(Request $request, PlaceSearch $places)
    {
        $validated = $request->validate([
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
        ]);
        $place = $places->reverse((float) $validated['lat'], (float) $validated['lng']);

        return response()->json($place ?? [
            'name' => 'Pinned location', 'address' => sprintf('%.5f, %.5f', $validated['lat'], $validated['lng']),
            'lat' => (float) $validated['lat'], 'lng' => (float) $validated['lng'],
        ]);
    }
}
