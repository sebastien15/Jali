<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Locations\Application\PickupLocations;
use Illuminate\Http\Request;

/** Transport adapter for Locations (runbook M03-Bus): validation + HTTP shape only. */
class LocationController extends Controller
{
    public function __construct(private readonly PickupLocations $locations)
    {
    }

    public function index(Request $request)
    {
        // Each location is enriched with its province, corridors, and agencies.
        return response()->json($this->locations->list($request->only(["type", "city"])));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            "name" => "required|string|max:255",
            "type" => "required|in:bus_station,custom",
            "city" => "required|string|max:255",
            "address" => "nullable|string|max:500",
            "latitude" => "nullable|numeric",
            "longitude" => "nullable|numeric",
        ]);

        return response()->json($this->locations->create($data), 201);
    }

    public function update(Request $request, $id)
    {
        $location = $this->locations->find($id);

        $data = $request->validate([
            "name" => "sometimes|string|max:255",
            "type" => "sometimes|in:bus_station,custom",
            "city" => "sometimes|string|max:255",
            "address" => "nullable|string|max:500",
            "latitude" => "nullable|numeric",
            "longitude" => "nullable|numeric",
        ]);

        return response()->json($this->locations->update($location, $data));
    }

    public function destroy($id)
    {
        // Refused while admins are assigned here or bookings reference it.
        if ($refusal = $this->locations->delete($id)) {
            return response()->json(["error" => $refusal], 422);
        }

        return response()->json(["message" => "Location deleted."]);
    }
}
