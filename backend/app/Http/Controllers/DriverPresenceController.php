<?php

namespace App\Http\Controllers;

use App\Modules\NearbyRides\Application\DriverPresenceSwitch;
use Illuminate\Http\Request;

/**
 * Online/offline switch and location heartbeat (story S5.1).
 * Transport adapter for NearbyRides (runbook M03-Rides): validation + HTTP shape only.
 */
class DriverPresenceController extends Controller
{
    public function __construct(private readonly DriverPresenceSwitch $presence)
    {
    }

    /** GET /driver/presence */
    public function show(Request $request)
    {
        return response()->json($this->presence->payload($request->user()));
    }

    /** POST /driver/presence  { online, lat?, lng?, heading? } — call every 5–10 s while online */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'online'  => 'required|boolean',
            'lat'     => 'required_if:online,true|nullable|numeric|between:-90,90',
            'lng'     => 'required_if:online,true|nullable|numeric|between:-180,180',
            'heading' => 'sometimes|nullable|numeric|between:0,360',
        ]);

        return response()->json($this->presence->update($request->user(), $validated));
    }
}
