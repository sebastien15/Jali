<?php

namespace App\Http\Controllers;

use App\Modules\ServiceAccess\Contracts\ServiceAccess;
use Illuminate\Http\Request;

/** GET /me/service-access — which services this account can see, use and offer here (S23.1) */
class ServiceAccessController extends Controller
{
    public function show(Request $request, ServiceAccess $access)
    {
        $data = $request->validate([
            'lat'         => 'sometimes|numeric|between:-90,90',
            'lng'         => 'required_with:lat|numeric|between:-180,180',
            'app_version' => ['sometimes', 'string', 'max:20', 'regex:/^\d+(\.\d+){0,2}$/'],
        ]);

        return response()->json($access->forUser(
            $request->user(),
            isset($data['lat']) ? (float) $data['lat'] : null,
            isset($data['lng']) ? (float) $data['lng'] : null,
            $data['app_version'] ?? null,
        ));
    }
}
