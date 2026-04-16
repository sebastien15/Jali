<?php

namespace App\Http\Controllers;

use App\Models\AgencyRoute;
use Illuminate\Http\Request;

class TripSearchController extends Controller
{
    /**
     * Return active agency routes grouped with their departure times.
     * Each route has a `departures` array — one card per agency on the user side.
     */
    public function index(Request $request)
    {
        $request->validate([
            'from_station_id' => 'nullable|exists:admin_stations,id',
            'to_station_id'   => 'nullable|exists:admin_stations,id',
            'agency_id'       => 'nullable|exists:agencies,id',
        ]);

        $query = AgencyRoute::with([
            'agency.ratings',
            'fromStation',
            'toStation',
            'departures' => fn($q) => $q->where('active', true)->orderBy('departure_time'),
        ])->where('active', true);

        if ($request->filled('from_station_id')) {
            $query->where('from_station_id', $request->from_station_id);
        }
        if ($request->filled('to_station_id')) {
            $query->where('to_station_id', $request->to_station_id);
        }
        if ($request->filled('agency_id')) {
            $query->where('agency_id', $request->agency_id);
        }

        $paginator = $query->whereHas('departures', fn($q) => $q->where('active', true))
            ->paginate(20);

        return response()->json($paginator->through(fn($r) => [
            'id'                   => $r->id,
            'agency_id'            => $r->agency_id,
            'agency_name'          => $r->agency->name,
            'agency_rating'        => $r->agency->average_rating,
            'agency_ratings_count' => $r->agency->ratings->count(),
            'from'                 => [
                'id'   => $r->fromStation->id,
                'name' => $r->fromStation->name,
                'city' => $r->fromStation->city,
            ],
            'to'                   => [
                'id'   => $r->toStation->id,
                'name' => $r->toStation->name,
                'city' => $r->toStation->city,
            ],
            'price'        => $r->price,
            'total_seats'  => $r->total_seats,
            'duration_mins' => $r->duration_mins,
            'departures'   => $r->departures->map(fn($d) => [
                'id'                     => $d->id,
                'departure_time'         => substr($d->departure_time, 0, 5),
                'estimated_arrival_time' => $this->arrivalTime($d->departure_time, $r->duration_mins),
            ])->values(),
        ]));
    }

    private function arrivalTime(string $departure, int $durationMins): string
    {
        [$h, $m] = array_map('intval', explode(':', substr($departure, 0, 5)));
        $total = $h * 60 + $m + $durationMins;
        return sprintf('%02d:%02d', intdiv($total % (24 * 60), 60), $total % 60);
    }
}
