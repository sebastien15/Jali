<?php

namespace App\Http\Controllers;

use App\Modules\Locations\Contracts\ServiceAreas;
use Illuminate\Http\Request;

/** GET /service-areas/check — is a service available at this point? (S10.4) */
class ServiceAreaController extends Controller
{
    public function check(Request $request, ServiceAreas $areas)
    {
        $data = $request->validate([
            'lat'     => 'required|numeric|between:-90,90',
            'lng'     => 'required|numeric|between:-180,180',
            'service' => 'sometimes|in:' . implode(',', ServiceAreas::SERVICES),
        ]);

        return response()->json($areas->availability((float) $data['lat'], (float) $data['lng'], $data['service'] ?? 'rides'));
    }
}
