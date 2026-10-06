<?php

namespace App\Modules\Bus\Application;

use App\Models\ActivityLog;
use App\Models\AgencyRoute;
use App\Models\TripDeparture;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Admin agency-route and departure operations (/admin/trips/**). Changes need
 * the route's departure station (StationScope); removals are refused while a
 * departure holds an active booking. Every change is logged. Input is
 * validated by the transport adapter.
 */
class RouteAdmin
{
    public function __construct(private readonly StationScope $scope)
    {
    }

    /** All agency routes with their departures. */
    public function list(mixed $agencyId, ?bool $active): Collection
    {
        return AgencyRoute::with(['agency', 'fromStation', 'toStation', 'departures'])
            ->when($agencyId, fn($q) => $q->where('agency_id', $agencyId))
            ->when($active !== null, fn($q) => $q->where('active', $active))
            ->get()
            ->map(fn($r) => $this->format($r));
    }

    public function show(int|string $id): array
    {
        return $this->format(AgencyRoute::with(['agency', 'fromStation', 'toStation', 'departures'])->findOrFail($id));
    }

    /** @throws \Illuminate\Database\Eloquent\ModelNotFoundException */
    public function find(int|string $id): AgencyRoute
    {
        return AgencyRoute::findOrFail($id);
    }

    /** 403 unless the admin manages the route's departure station. */
    public function authorize(User $admin, AgencyRoute $route): void
    {
        $this->scope->abortUnlessManagesStation($admin, (int) $route->from_station_id);
    }

    /**
     * Create a route (optionally with a first departure time).
     *
     * @throws BusRequestRejected
     */
    public function create(User $admin, array $validated): array
    {
        $this->scope->abortUnlessManagesStation($admin, (int) $validated['from_station_id']);

        $unique = AgencyRoute::where('agency_id', $validated['agency_id'])
            ->where('from_station_id', $validated['from_station_id'])
            ->where('to_station_id', $validated['to_station_id'])
            ->exists();

        if ($unique) {
            throw BusRequestRejected::error(422, 'A route for this agency and stations already exists.');
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

        $this->log($admin, 'route_created', $route->id, $route);

        return $this->format($route);
    }

    /**
     * Update price, seats, duration, active. Caller has authorized the route.
     *
     * @throws BusRequestRejected
     */
    public function update(User $admin, AgencyRoute $route, array $validated): array
    {
        if (($validated['active'] ?? false) && ($validated['price'] ?? $route->price) < 100) {
            throw BusRequestRejected::errorAndMessage(422, 'Set a price before activating this route.');
        }

        $route->update($validated);
        $route->load(['agency', 'fromStation', 'toStation', 'departures']);

        $this->log($admin, 'route_updated', $route->id, $route);

        return $this->format($route);
    }

    /**
     * Delete a route. Blocked if any active bookings exist on its departures.
     *
     * @param int|string $id the route parameter, as received (logged as-is)
     * @throws BusRequestRejected
     */
    public function delete(User $admin, int|string $id): void
    {
        $route = AgencyRoute::with('departures')->findOrFail($id);
        $this->authorize($admin, $route);

        if ($this->scope->hasActiveBookings($route->departures->pluck('id'))) {
            throw BusRequestRejected::error(409, 'Cannot delete route with active bookings.');
        }

        $route->delete();

        $this->log($admin, 'route_deleted', $id, $route);
    }

    /**
     * Add a departure time to a route. Caller has authorized the route.
     *
     * @throws BusRequestRejected
     */
    public function addDeparture(User $admin, AgencyRoute $route, string $departureTime): array
    {
        $exists = TripDeparture::where('agency_route_id', $route->id)
            ->where('departure_time', $departureTime)
            ->exists();

        if ($exists) {
            throw BusRequestRejected::error(422, 'Departure time already exists for this route.');
        }

        $departure = TripDeparture::create([
            'agency_route_id' => $route->id,
            'departure_time'  => $departureTime,
            'active'          => true,
        ]);

        ActivityLog::create([
            'admin_id'    => $admin->id,
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

        return [
            'id'             => $departure->id,
            'departure_time' => substr($departure->departure_time, 0, 5),
            'active'         => $departure->active,
        ];
    }

    /**
     * Remove a departure time from a route.
     *
     * @param int|string $departureId the route parameter, as received (logged as-is)
     * @throws BusRequestRejected
     */
    public function removeDeparture(User $admin, int|string $routeId, int|string $departureId): void
    {
        $route     = AgencyRoute::findOrFail($routeId);
        $departure = TripDeparture::where('agency_route_id', $routeId)->findOrFail($departureId);
        $this->authorize($admin, $route);

        if ($this->scope->hasActiveBookings([$departure->id])) {
            throw BusRequestRejected::error(409, 'Cannot remove departure with active bookings.');
        }

        $departure->delete();

        ActivityLog::create([
            'admin_id'    => $admin->id,
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
    }

    private function log(User $admin, string $action, int|string $entityId, AgencyRoute $route): void
    {
        ActivityLog::create([
            'admin_id'    => $admin->id,
            'action'      => $action,
            'entity_type' => 'agency_route',
            'entity_id'   => $entityId,
            'details'     => [
                'agency' => $route->agency->name,
                'from'   => $route->fromStation->city,
                'to'     => $route->toStation->city,
            ],
        ]);
    }

    private function format(AgencyRoute $r): array
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
