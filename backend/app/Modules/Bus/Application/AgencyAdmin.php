<?php

namespace App\Modules\Bus\Application;

use App\Models\ActivityLog;
use App\Models\Agency;
use App\Models\AgencyRoute;
use App\Models\TripDeparture;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Admin agency operations (/admin/agencies/**). Creating/deleting agencies is
 * superadmin-only; adding/removing a route needs the route's departure station
 * (StationScope). Every change is logged. Input is validated by the transport.
 */
class AgencyAdmin
{
    public function __construct(private readonly StationScope $scope)
    {
    }

    /** All agencies with routes and average rating. */
    public function list(): Collection
    {
        return Agency::with(['routes.fromStation', 'routes.toStation', 'ratings'])->get()
            ->map(fn($a) => $this->format($a));
    }

    public function show(int|string $id): array
    {
        return $this->format(Agency::with(['routes.fromStation', 'routes.toStation', 'ratings'])->findOrFail($id));
    }

    /** @throws \Illuminate\Database\Eloquent\ModelNotFoundException */
    public function find(int|string $id): Agency
    {
        return Agency::findOrFail($id);
    }

    public function create(User $admin, array $validated): array
    {
        $agency = Agency::create([
            ...$validated,
            'created_by' => $admin->id,
        ]);

        ActivityLog::create([
            'admin_id' => $admin->id,
            'action' => 'agency_created',
            'entity_type' => 'agency',
            'entity_id' => $agency->id,
            'details' => ['name' => $agency->name],
        ]);

        return $this->format($agency);
    }

    /** $validated is already restricted by role (regular admins: operating_hours only). */
    public function update(User $admin, Agency $agency, array $validated): array
    {
        $agency->update($validated);

        ActivityLog::create([
            'admin_id' => $admin->id,
            'action' => 'agency_updated',
            'entity_type' => 'agency',
            'entity_id' => $agency->id,
            'details' => ['name' => $agency->name],
        ]);

        return $this->format($agency);
    }

    /**
     * Delete an agency (cascades to routes, ratings, trips). Superadmin only;
     * refused while any of its departures holds an active booking.
     *
     * @throws BusRequestRejected
     */
    public function delete(User $admin, int|string $id): void
    {
        $this->scope->abortUnlessSuperAdmin($admin);

        $agency = Agency::findOrFail($id);
        $departureIds = TripDeparture::whereIn('agency_route_id', AgencyRoute::where('agency_id', $agency->id)->select('id'))->pluck('id');
        if ($this->scope->hasActiveBookings($departureIds)) {
            throw BusRequestRejected::errorAndMessage(409, 'Cannot delete an agency with active bookings.');
        }

        $name = $agency->name;
        $agency->delete();

        ActivityLog::create([
            'admin_id' => $admin->id,
            'action' => 'agency_deleted',
            'entity_type' => 'agency',
            'entity_id' => $id,
            'details' => ['name' => $name],
        ]);
    }

    /**
     * Add an (inactive, unpriced) route to an agency.
     *
     * @param int|string $agencyId the route parameter, as received
     * @throws BusRequestRejected
     */
    public function addRoute(User $admin, int|string $agencyId, array $validated): array
    {
        $this->scope->abortUnlessManagesStation($admin, (int) $validated['from_station_id']);

        // Prevent duplicate
        $existing = AgencyRoute::where('agency_id', $agencyId)
            ->where('from_station_id', $validated['from_station_id'])
            ->where('to_station_id', $validated['to_station_id'])
            ->first();

        if ($existing) {
            throw BusRequestRejected::error(409, 'Route already exists');
        }

        $route = AgencyRoute::create([
            'agency_id' => $agencyId,
            'from_station_id' => $validated['from_station_id'],
            'to_station_id' => $validated['to_station_id'],
            // Not bookable until a price, seats and departures are set in Trips.
            'active' => false,
        ]);

        ActivityLog::create([
            'admin_id' => $admin->id,
            'action' => 'agency_route_added',
            'entity_type' => 'agency',
            'entity_id' => $agencyId,
            'details' => [
                'from' => $route->fromStation->city,
                'to' => $route->toStation->city,
            ],
        ]);

        return [
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
        ];
    }

    /** @throws BusRequestRejected */
    public function removeRoute(User $admin, int|string $agencyId, int|string $routeId): void
    {
        $route = AgencyRoute::where('agency_id', $agencyId)->findOrFail($routeId);
        $this->scope->abortUnlessManagesStation($admin, (int) $route->from_station_id);
        if ($this->scope->hasActiveBookings($route->departures()->pluck('id'))) {
            throw BusRequestRejected::errorAndMessage(409, 'Cannot delete route with active bookings.');
        }

        $route->delete();

        ActivityLog::create([
            'admin_id' => $admin->id,
            'action' => 'agency_route_removed',
            'entity_type' => 'agency',
            'entity_id' => $agencyId,
            'details' => ['route_id' => $routeId],
        ]);
    }

    private function format(Agency $a): array
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
