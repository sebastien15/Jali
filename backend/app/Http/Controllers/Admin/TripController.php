<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Bus\Application\BusRequestRejected;
use App\Modules\Bus\Application\RouteAdmin;
use Illuminate\Http\Request;

/** Transport adapter for Bus (runbook M03-Bus): validation + HTTP shape only. */
class TripController extends Controller
{
    public function __construct(private readonly RouteAdmin $routes)
    {
    }

    /**
     * List all agency routes with their departures.
     */
    public function index(Request $request)
    {
        return response()->json($this->routes->list(
            $request->agency_id,
            $request->filled('active') ? $request->boolean('active') : null,
        ));
    }

    public function show($id)
    {
        return response()->json($this->routes->show($id));
    }

    /**
     * Create a new agency route (optionally with a first departure time).
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'agency_id'       => 'required|exists:agencies,id',
            'from_station_id' => 'required|exists:admin_stations,id|different:to_station_id',
            'to_station_id'   => 'required|exists:admin_stations,id',
            'price'           => 'required|integer|min:100',
            'total_seats'     => 'required|integer|min:1|max:200',
            'duration_mins'   => 'required|integer|min:1|max:1440',
            'active'          => 'boolean',
            'departure_time'  => 'nullable|date_format:H:i',
        ]);

        try {
            return response()->json($this->routes->create($request->user(), $validated), 201);
        } catch (BusRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }

    /**
     * Update route details (price, seats, duration, active).
     */
    public function update(Request $request, $id)
    {
        // Lookup (404) and station scope (403) win over validation, as before.
        $route = $this->routes->find($id);
        $this->routes->authorize($request->user(), $route);

        $validated = $request->validate([
            'price'         => 'sometimes|integer|min:100',
            'total_seats'   => 'sometimes|integer|min:1|max:200',
            'duration_mins' => 'sometimes|integer|min:1|max:1440',
            'active'        => 'sometimes|boolean',
        ]);

        try {
            return response()->json($this->routes->update($request->user(), $route, $validated));
        } catch (BusRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }

    /**
     * Delete a route. Blocked if any active bookings exist on its departures.
     */
    public function destroy(Request $request, $id)
    {
        try {
            $this->routes->delete($request->user(), $id);
        } catch (BusRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }

        return response()->json(['message' => 'Route deleted.']);
    }

    /**
     * Add a departure time to a route.
     */
    public function addDeparture(Request $request, $id)
    {
        $route = $this->routes->find($id);
        $this->routes->authorize($request->user(), $route);

        $validated = $request->validate([
            'departure_time' => 'required|date_format:H:i',
        ]);

        try {
            return response()->json($this->routes->addDeparture($request->user(), $route, $validated['departure_time']), 201);
        } catch (BusRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }

    /**
     * Remove a departure time from a route.
     */
    public function removeDeparture(Request $request, $routeId, $departureId)
    {
        try {
            $this->routes->removeDeparture($request->user(), $routeId, $departureId);
        } catch (BusRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }

        return response()->json(['message' => 'Departure removed.']);
    }
}
