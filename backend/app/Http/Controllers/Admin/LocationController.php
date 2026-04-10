<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Location;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function index(Request $request)
    {
        $query = Location::query();

        if ($request->has("type")) {
            $query->where("type", $request->type);
        }
        if ($request->has("city")) {
            $query->where("city", $request->city);
        }

        $locations = $query->orderBy("city")->orderBy("name")->get();
        return response()->json($locations);
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

        $location = Location::create($data);
        return response()->json($location, 201);
    }

    public function update(Request $request, $id)
    {
        $location = Location::findOrFail($id);

        $data = $request->validate([
            "name" => "sometimes|string|max:255",
            "type" => "sometimes|in:bus_station,custom",
            "city" => "sometimes|string|max:255",
            "address" => "nullable|string|max:500",
            "latitude" => "nullable|numeric",
            "longitude" => "nullable|numeric",
        ]);

        $location->update($data);
        return response()->json($location);
    }

    public function destroy($id)
    {
        $location = Location::findOrFail($id);

        // Check if any admin is assigned here
        if ($location->admins()->exists()) {
            return response()->json(
                [
                    "error" =>
                        "Cannot delete: admins are assigned to this location.",
                ],
                422,
            );
        }

        // Check if any bookings reference this location
        if ($location->bookings()->exists()) {
            return response()->json(
                [
                    "error" =>
                        "Cannot delete: bookings reference this location.",
                ],
                422,
            );
        }

        $location->delete();
        return response()->json(["message" => "Location deleted."]);
    }
}
