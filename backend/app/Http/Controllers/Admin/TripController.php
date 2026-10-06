<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\AgencyRoute;
use App\Models\TripDeparture;
use Illuminate\Http\Request;

class TripController extends Controller
{
    /**
     * List all agency routes with their departures.
     */
    public function index(Request $request)
    {
        $routes = AgencyRoute::with(['agency', 'fromStation', 'toStation', 'departures'])
            ->when($request->agency_id, fn($q) => $q->where('agency_id', $request->agency_id))
            ->when($request->filled('active'), fn($q) => $q->where('active', $request->boolean('active')))
            ->get();

        return response()->json($routes->map(fn($r) => $this->formatRoute($r)));
    }

    public function show($id)
    {
        $route = AgencyRoute::with(['agency', 'fromStation', 'toStation', 'departures'])->findOrFail($id);
        return response()->json($this->formatRoute($route));
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
        $this->abortUnlessManagesStation($request->user(), (int) $validated['from_station_id']);

        $unique = AgencyRoute::where('agency_id', $validated['agency_id'])
            ->where('from_station_id', $validated['from_station_id'])
            ->where('to_station_id', $validated['to_station_id'])
            ->exists();

        if ($unique) {
            return response()->json(['error' => 'A route for this agency and stations already exists.'], 422);
        }

        $route = AgencyRoute::create([
            'agency_id'       => $validated['agency_id'],
            'from_station_id' => $validated['from_station_id'],
            'to_station_id'   => $validated['to_station_id'],
            'price'           => $validated['price'],
            'total_seats'     => $validated['total_seats'],
            'duration_mins'   => $validated['duration_mins'],
            'active'          => $validated['active'] ?? true,
        ]);

        if (!empty($validated['departure_time'])) {
            TripDeparture::create([
                'agency_route_id' => $route->id,
                'departure_time'  => $validated['departure_time'],
                'active'          => true,
            ]);
        }

        $route->load(['agency', 'fromStation', 'toStation', 'departures']);

        ActivityLog::create([
            'admin_id'    => $request->user()->id,
            'action'      => 'route_created',
            'entity_type' => 'agency_route',
            'entity_id'   => $route->id,
            'details'     => [
                'agency' => $route->agency->name,
                'from'   => $route->fromStation->city,
                'to'     => $route->toStation->city,
            ],
        ]);

        return response()->json($this->formatRoute($route), 201);
    }

    /**
     * Update route details (price, seats, duration, active).
     */
    public function update(Request $request, $id)
    {
        $route = AgencyRoute::findOrFail($id);
        $this->abortUnlessManagesStation($request->user(), (int) $route->from_station_id);

        $validated = $request->validate([
            'price'         => 'sometimes|integer|min:100',
            'total_seats'   => 'sometimes|integer|min:1|max:200',
            'duration_mins' => 'sometimes|integer|min:1|max:1440',
            'active'        => 'sometimes|boolean',
        ]);

        if (($validated['active'] ?? false) && ($validated['price'] ?? $route->price) < 100) {
            return response()->json(['error' => 'Set a price before activating this route.', 'message' => 'Set a price before activating this route.'], 422);
        }

        $route->update($validated);
        $route->load(['agency', 'fromStation', 'toStation', 'departures']);

        ActivityLog::create([
            'admin_id'    => $request->user()->id,
            'action'      => 'route_updated',
            'entity_type' => 'agency_route',
            'entity_id'   => $route->id,
            'details'     => [
                'agency' => $route->agency->name,
                'from'   => $route->fromStation->city,
                'to'     => $route->toStation->city,
            ],
        ]);

        return response()->json($this->formatRoute($route));
    }

    /**
     * Delete a route. Blocked if any active bookings exist on its departures.
     */
    public function destroy(Request $request, $id)
    {
        $route = AgencyRoute::with('departures')->findOrFail($id);
        $this->abortUnlessManagesStation($request->user(), (int) $route->from_station_id);

        if ($this->hasActiveBookings($route->departures->pluck('id'))) {
            return response()->json(['error' => 'Cannot delete route with active bookings.'], 409);
        }

        $route->delete();

        ActivityLog::create([
            'admin_id'    => $request->user()->id,
            'action'      => 'route_deleted',
            'entity_type' => 'agency_route',
            'entity_id'   => $id,
            'details'     => [
                'agency' => $route->agency->name,
                'from'   => $route->fromStation->city,
                'to'     => $route->toStation->city,
            ],
        ]);

        return response()->json(['message' => 'Route deleted.']);
    }

    /**
     * Add a departure time to a route.
     */
    public function addDeparture(Request $request, $id)
    {
        $route = AgencyRoute::findOrFail($id);
        $this->abortUnlessManagesStation($request->user(), (int) $route->from_station_id);

        $validated = $request->validate([
            'departure_time' => 'required|date_format:H:i',
        ]);

        $exists = TripDeparture::where('agency_route_id', $route->id)
            ->where('departure_time', $validated['departure_time'])
            ->exists();

        if ($exists) {
            return response()->json(['error' => 'Departure time already exists for this route.'], 422);
        }

        $departure = TripDeparture::create([
            'agency_route_id' => $route->id,
            'departure_time'  => $validated['departure_time'],
            'active'          => true,
        ]);

        ActivityLog::create([
            'admin_id'    => $request->user()->id,
            'action'      => 'departure_added',
            'entity_type' => 'trip_departure',
            'entity_id'   => $departure->id,
            'details'     => [
                'agency'         => $route->agency->name,
                'from'           => $route->fromStation->city,
                'to'             => $route->toStation->city,
                'departure_time' => $departure->departure_time,
            ],
        ]);

        return response()->json([
            'id'             => $departure->id,
            'departure_time' => substr($departure->departure_time, 0, 5),
            'active'         => $departure->active,
        ], 201);
    }

    /**
     * Remove a departure time from a route.
     */
    public function removeDeparture(Request $request, $routeId, $departureId)
    {
        $route     = AgencyRoute::findOrFail($routeId);
        $departure = TripDeparture::where('agency_route_id', $routeId)->findOrFail($departureId);
        $this->abortUnlessManagesStation($request->user(), (int) $route->from_station_id);

        if ($this->hasActiveBookings([$departure->id])) {
            return response()->json(['error' => 'Cannot remove departure with active bookings.'], 409);
        }

        $departure->delete();

        ActivityLog::create([
            'admin_id'    => $request->user()->id,
            'action'      => 'departure_removed',
            'entity_type' => 'trip_departure',
            'entity_id'   => $departureId,
            'details'     => [
                'agency'         => $route->agency->name,
                'from'           => $route->fromStation->city,
                'to'             => $route->toStation->city,
                'departure_time' => $departure->departure_time,
            ],
        ]);

        return response()->json(['message' => 'Departure removed.']);
    }

    private function formatRoute(AgencyRoute $r): array
    {
        return [
            'id'           => $r->id,
            'agency_id'    => $r->agency_id,
            'agency_name'  => $r->agency->name,
            'from'         => [
                'id'       => $r->fromStation->id,
                'city'     => $r->fromStation->city,
                'district' => $r->fromStation->district,
            ],
            'to'           => [
                'id'       => $r->toStation->id,
                'city'     => $r->toStation->city,
                'district' => $r->toStation->district,
            ],
            'price'        => $r->price,
            'total_seats'  => $r->total_seats,
            'duration_mins' => $r->duration_mins,
            'active'       => $r->active,
            'departures'   => $r->departures->map(fn($d) => [
                'id'             => $d->id,
                'departure_time' => substr($d->departure_time, 0, 5),
                'active'         => $d->active,
            ])->values(),
        ];
    }
}
