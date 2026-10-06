<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Bus\Application\AgencyAdmin;
use App\Modules\Bus\Application\BusRequestRejected;
use App\Modules\Bus\Application\StationScope;
use Illuminate\Http\Request;

/** Transport adapter for Bus (runbook M03-Bus): validation + HTTP shape only. */
class AgencyController extends Controller
{
    public function __construct(
        private readonly AgencyAdmin $agencies,
        private readonly StationScope $scope,
    ) {
    }

    /**
     * List all agencies with routes and average rating.
     */
    public function index()
    {
        return response()->json($this->agencies->list());
    }

    public function show($id)
    {
        return response()->json($this->agencies->show($id));
    }

    /**
     * Create a new agency.
     */
    public function store(Request $request)
    {
        $this->scope->abortUnlessSuperAdmin($request->user());

        $validated = $request->validate([
            'name' => 'required|string|max:150',
        ]);

        return response()->json($this->agencies->create($request->user(), $validated), 201);
    }

    /**
     * Update an agency.
     */
    public function update(Request $request, $id)
    {
        $agency = $this->agencies->find($id);
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

        return response()->json($this->agencies->update($user, $agency, $validated));
    }

    /**
     * Delete an agency (cascades to routes, ratings, trips).
     */
    public function destroy(Request $request, $id)
    {
        try {
            $this->agencies->delete($request->user(), $id);
        } catch (BusRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }

        return response()->json(['message' => 'Agency deleted']);
    }

    /**
     * Add a route to an agency.
     */
    public function addRoute(Request $request, $id)
    {
        // 404 for an unknown agency wins over validation, as before.
        $this->agencies->find($id);

        $validated = $request->validate([
            'from_station_id' => 'required|exists:admin_stations,id|different:to_station_id',
            'to_station_id' => 'required|exists:admin_stations,id',
        ]);

        try {
            return response()->json($this->agencies->addRoute($request->user(), $id, $validated), 201);
        } catch (BusRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }

    /**
     * Remove a route from an agency.
     */
    public function removeRoute(Request $request, $agencyId, $routeId)
    {
        try {
            $this->agencies->removeRoute($request->user(), $agencyId, $routeId);
        } catch (BusRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }

        return response()->json(['message' => 'Route removed']);
    }
}
