<?php

namespace App\Modules\Bus\Application;

use App\Models\AgencyRoute;
use App\Models\Bus;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

/** Public bus catalogue: legacy `/buses` listings and the `/trips` departure search. */
class BusCatalogue
{
    /**
     * Active legacy buses ordered by departure. Each key present in $filters
     * (`from`, `to`) is matched exactly, as the old `$request->has()` checks did.
     * Buses run daily, so a date filter is informational only.
     */
    public function buses(array $filters): Collection
    {
        $query = Bus::query()->where('active', true);

        if (array_key_exists('from', $filters)) {
            $query->where('from', $filters['from']);
        }
        if (array_key_exists('to', $filters)) {
            $query->where('to', $filters['to']);
        }

        return $query->orderBy('dep')->get();
    }

    /**
     * Active agency routes with at least one active departure, 20 per page.
     * Each route has a `departures` array — one card per agency on the user side.
     * Filters are already validated; null means "not filtered".
     */
    public function trips(?string $fromStationId, ?string $toStationId, ?string $agencyId): LengthAwarePaginator
    {
        $query = AgencyRoute::with([
            'agency.ratings',
            'fromStation',
            'toStation',
            'departures' => fn($q) => $q->where('active', true)->orderBy('departure_time'),
        ])->where('active', true);

        if ($fromStationId !== null) {
            $query->where('from_station_id', $fromStationId);
        }
        if ($toStationId !== null) {
            $query->where('to_station_id', $toStationId);
        }
        if ($agencyId !== null) {
            $query->where('agency_id', $agencyId);
        }

        $paginator = $query->whereHas('departures', fn($q) => $q->where('active', true))
            ->paginate(20);

        return $paginator->through(fn($r) => [
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
                'estimated_arrival_time' => self::arrivalTime($d->departure_time, $r->duration_mins),
            ])->values(),
        ]);
    }

    /** "23:00" + 150 min → "01:30" (wraps past midnight). */
    private static function arrivalTime(string $departure, int $durationMins): string
    {
        [$h, $m] = array_map('intval', explode(':', substr($departure, 0, 5)));
        $total = $h * 60 + $m + $durationMins;
        return sprintf('%02d:%02d', intdiv($total % (24 * 60), 60), $total % 60);
    }
}
