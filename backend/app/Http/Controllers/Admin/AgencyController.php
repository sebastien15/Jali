<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Agency;
use App\Models\AgencyRoute;
use Illuminate\Http\Request;

class AgencyController extends Controller
{
    /**
     * List all agencies with routes and average rating.
     */
    public function index()
    {
        $agencies = Agency::with(['routes.fromStation', 'routes.toStation', 'ratings'])->get();

        return response()->json($agencies->map(fn($a) => [
            'id' => $a->id,
            'name' => $a->name,
            'operating_hours' => $a->operating_hours,
            'average_rating' => $a->average_rating,
            'ratings_count' => $a->ratings->count(),
            'routes' => $a->routes->map(fn($r) => [
                'id' => $r->id,
                'from' => [
                    'id' => $r->fromStation->id,
                    'city' => $r->fromStation->city,
                    'district' => $r->fromStation->district,
                ],
                'to' => [
                    'id' => $r->toStation->id,
                    'city' => $r->toStation->city,
                    'district' => $r->toStation->district,
                ],
            ]),
        ]));
    }

    /**
     * Create a new agency.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
        ]);

        $agency = Agency::create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        ActivityLog::create([
            'admin_id' => $request->user()->id,
            'action' => 'agency_created',
            'entity_type' => 'agency',
            'entity_id' => $agency->id,
            'details' => ['name' => $agency->name],
        ]);

        return response()->json($this->formatAgency($agency), 201);
    }

    /**
     * Update an agency.
     */
    public function update(Request $request, $id)
    {
        $agency = Agency::findOrFail($id);
        $user = $request->user();
        $isSuperAdmin = $user->hasRole('superadmin');

        // Regular admins can only update operating_hours
        if ($isSuperAdmin) {
            $validated = $request->validate([
                'name'            => 'sometimes|string|max:150',
                'operating_hours' => 'sometimes|nullable|string|max:100',
            ]);
        } else {
            $validated = $request->validate([
                'operating_hours' => 'required|string|max:100',
            ]);
        }

        $agency->update($validated);

        ActivityLog::create([
            'admin_id' => $request->user()->id,
            'action' => 'agency_updated',
            'entity_type' => 'agency',
            'entity_id' => $agency->id,
            'details' => ['name' => $agency->name],
        ]);

        return response()->json($this->formatAgency($agency));
    }

    /**
     * Delete an agency (cascades to routes, ratings, trips).
     */
    public function destroy(Request $request, $id)
    {
        $agency = Agency::findOrFail($id);
        $name = $agency->name;
        $agency->delete();

        ActivityLog::create([
            'admin_id' => $request->user()->id,
            'action' => 'agency_deleted',
            'entity_type' => 'agency',
            'entity_id' => $id,
            'details' => ['name' => $name],
        ]);

        return response()->json(['message' => 'Agency deleted']);
    }

    /**
     * Add a route to an agency.
     */
    public function addRoute(Request $request, $id)
    {
        $agency = Agency::findOrFail($id);

        $validated = $request->validate([
            'from_station_id' => 'required|exists:admin_stations,id',
            'to_station_id' => 'required|exists:admin_stations,id',
        ]);

        // Prevent duplicate
        $existing = AgencyRoute::where('agency_id', $id)
            ->where('from_station_id', $validated['from_station_id'])
            ->where('to_station_id', $validated['to_station_id'])
            ->first();

        if ($existing) {
            return response()->json(['error' => 'Route already exists'], 409);
        }

        $route = AgencyRoute::create([
            'agency_id' => $id,
            'from_station_id' => $validated['from_station_id'],
            'to_station_id' => $validated['to_station_id'],
        ]);

        ActivityLog::create([
            'admin_id' => $request->user()->id,
            'action' => 'agency_route_added',
            'entity_type' => 'agency',
            'entity_id' => $id,
            'details' => [
                'from' => $route->fromStation->city,
                'to' => $route->toStation->city,
            ],
        ]);

        return response()->json([
            'id' => $route->id,
            'from' => [
                'id' => $route->fromStation->id,
                'city' => $route->fromStation->city,
                'district' => $route->fromStation->district,
            ],
            'to' => [
                'id' => $route->toStation->id,
                'city' => $route->toStation->city,
                'district' => $route->toStation->district,
            ],
        ], 201);
    }

    /**
     * Remove a route from an agency.
     */
    public function removeRoute(Request $request, $agencyId, $routeId)
    {
        $route = AgencyRoute::where('agency_id', $agencyId)->findOrFail($routeId);

        $route->delete();

        ActivityLog::create([
            'admin_id' => $request->user()->id,
            'action' => 'agency_route_removed',
            'entity_type' => 'agency',
            'entity_id' => $agencyId,
            'details' => ['route_id' => $routeId],
        ]);

        return response()->json(['message' => 'Route removed']);
    }

    private function formatAgency(Agency $a): array
    {
        return [
            'id' => $a->id,
            'name' => $a->name,
            'operating_hours' => $a->operating_hours,
            'average_rating' => $a->average_rating,
            'ratings_count' => $a->ratings->count(),
            'routes' => $a->routes->map(fn($r) => [
                'id' => $r->id,
                'from' => [
                    'id' => $r->fromStation->id,
                    'city' => $r->fromStation->city,
                    'district' => $r->fromStation->district,
                ],
                'to' => [
                    'id' => $r->toStation->id,
                    'city' => $r->toStation->city,
                    'district' => $r->toStation->district,
                ],
            ]),
        ];
    }
}
