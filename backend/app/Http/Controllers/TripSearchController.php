<?php

namespace App\Http\Controllers;

use App\Models\Trip;
use Illuminate\Http\Request;

class TripSearchController extends Controller
{
    /**
     * Public trip search — no auth required.
     */
    public function index(Request $request)
    {
        $request->validate([
            'from_station_id' => 'nullable|exists:admin_stations,id',
            'to_station_id'   => 'nullable|exists:admin_stations,id',
            'agency_id'       => 'nullable|exists:agencies,id',
        ]);

        $query = Trip::with(['agency.ratings', 'fromStation', 'toStation'])
            ->where('active', true);

        if ($request->filled('from_station_id')) {
            $query->where('from_station_id', $request->from_station_id);
        }
        if ($request->filled('to_station_id')) {
            $query->where('to_station_id', $request->to_station_id);
        }
        if ($request->filled('agency_id')) {
            $query->where('agency_id', $request->agency_id);
        }

        $trips = $query->orderBy('departure_time')->get();

        return response()->json($trips->map(fn($t) => [
            'id'                       => $t->id,
            'agency_id'                => $t->agency_id,
            'agency_name'              => $t->agency->name,
            'agency_rating'            => $t->agency->average_rating,
            'agency_ratings_count'     => $t->agency->ratings->count(),
            'from'                     => [
                'id'   => $t->fromStation->id,
                'name' => $t->fromStation->name,
                'city' => $t->fromStation->city,
            ],
            'to'                       => [
                'id'   => $t->toStation->id,
                'name' => $t->toStation->name,
                'city' => $t->toStation->city,
            ],
            'departure_time'           => $t->departure_time,
            'estimated_arrival_time'   => $t->estimated_arrival_time,
            'price'                    => $t->price,
            'total_seats'              => $t->total_seats,
        ]));
    }
}
