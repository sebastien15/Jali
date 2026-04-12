<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Trip;
use Illuminate\Http\Request;

class TripController extends Controller
{
    /**
     * List trips with agency and station info.
     */
    public function index(Request $request)
    {
        $trips = Trip::with(['agency', 'fromStation', 'toStation'])
            ->when($request->agency_id, fn($q) => $q->where('agency_id', $request->agency_id))
            ->when($request->filled('active'), fn($q) => $q->where('active', $request->boolean('active')))
            ->orderBy('departure_time')
            ->get();

        return response()->json($trips->map(fn($t) => $this->formatTrip($t)));
    }

    /**
     * Create a new trip.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'agency_id'              => 'required|exists:agencies,id',
            'from_station_id'        => 'required|exists:admin_stations,id|different:to_station_id',
            'to_station_id'          => 'required|exists:admin_stations,id',
            'departure_time'         => 'required|date_format:H:i',
            'estimated_arrival_time' => 'required|date_format:H:i',
            'price'                  => 'required|integer|min:100',
            'total_seats'            => 'required|integer|min:1|max:200',
            'active'                 => 'boolean',
        ]);

        $trip = Trip::create($validated);

        ActivityLog::create([
            'admin_id'    => $request->user()->id,
            'action'      => 'trip_created',
            'entity_type' => 'trip',
            'entity_id'   => $trip->id,
            'details'     => [
                'agency'  => $trip->agency->name,
                'from'    => $trip->fromStation->city,
                'to'      => $trip->toStation->city,
                'departure' => $trip->departure_time,
            ],
        ]);

        return response()->json($this->formatTrip($trip), 201);
    }

    /**
     * Update a trip.
     */
    public function update(Request $request, $id)
    {
        $trip = Trip::findOrFail($id);

        $validated = $request->validate([
            'agency_id'              => 'sometimes|exists:agencies,id',
            'from_station_id'        => 'sometimes|exists:admin_stations,id|different:to_station_id',
            'to_station_id'          => 'sometimes|exists:admin_stations,id',
            'departure_time'         => 'sometimes|date_format:H:i',
            'estimated_arrival_time' => 'sometimes|date_format:H:i',
            'price'                  => 'sometimes|integer|min:100',
            'total_seats'            => 'sometimes|integer|min:1|max:200',
            'active'                 => 'sometimes|boolean',
        ]);

        $trip->update($validated);

        ActivityLog::create([
            'admin_id'    => $request->user()->id,
            'action'      => 'trip_updated',
            'entity_type' => 'trip',
            'entity_id'   => $trip->id,
            'details'     => [
                'agency'  => $trip->agency->name,
                'from'    => $trip->fromStation->city,
                'to'      => $trip->toStation->city,
            ],
        ]);

        return response()->json($this->formatTrip($trip));
    }

    /**
     * Delete a trip. Returns 409 if trip has pending/confirmed bookings.
     */
    public function destroy(Request $request, $id)
    {
        $trip = Trip::findOrFail($id);

        // Check for pending or confirmed bookings
        $hasBookings = $trip->bookings()
            ->whereIn('status', ['pending', 'confirmed', 'taken', 'ticket_ready'])
            ->exists();

        if ($hasBookings) {
            return response()->json([
                'error' => 'Cannot delete trip with active bookings',
            ], 409);
        }

        $trip->delete();

        ActivityLog::create([
            'admin_id'    => $request->user()->id,
            'action'      => 'trip_deleted',
            'entity_type' => 'trip',
            'entity_id'   => $id,
            'details'     => [
                'agency' => $trip->agency->name,
                'from'   => $trip->fromStation->city,
                'to'     => $trip->toStation->city,
            ],
        ]);

        return response()->json(['message' => 'Trip deleted']);
    }

    private function formatTrip(Trip $t): array
    {
        return [
            'id'                     => $t->id,
            'agency_id'              => $t->agency_id,
            'agency_name'            => $t->agency->name,
            'from'                   => [
                'id'       => $t->fromStation->id,
                'city'     => $t->fromStation->city,
                'district' => $t->fromStation->district,
            ],
            'to'                     => [
                'id'       => $t->toStation->id,
                'city'     => $t->toStation->city,
                'district' => $t->toStation->district,
            ],
            'departure_time'         => $t->departure_time,
            'estimated_arrival_time' => $t->estimated_arrival_time,
            'price'                  => $t->price,
            'total_seats'            => $t->total_seats,
            'active'                 => $t->active,
        ];
    }
}
