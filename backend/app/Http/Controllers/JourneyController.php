<?php

namespace App\Http\Controllers;

use App\Models\PrivateSeat;
use App\Modules\SharedJourneys\Application\JourneySearch;
use App\Modules\SharedJourneys\Application\SegmentSeats;
use Carbon\Carbon;
use Illuminate\Http\Request;

/** Shared journeys for passengers (Batch 3): validation + HTTP shape only. */
class JourneyController extends Controller
{
    public function __construct(private readonly JourneySearch $search)
    {
    }

    /** GET /journeys/search?from&to&date&seats — journeys passing through from, then to (S25.3) */
    public function search(Request $request)
    {
        $data = $request->validate([
            'from'  => 'required|string|max:80',
            'to'    => 'required|string|max:80|different:from',
            'date'  => 'required|date_format:Y-m-d',
            'seats' => 'sometimes|integer|min:1|max:6',
        ]);

        return response()->json($this->search->search($data['from'], $data['to'], $data['date'], (int) ($data['seats'] ?? 1)));
    }

    /** GET /journeys/{id}?date — stops, fares and seats left per segment for that date */
    public function show(Request $request, int $id)
    {
        $date = $request->validate(['date' => 'sometimes|date_format:Y-m-d'])['date'] ?? Carbon::now(JourneySearch::TZ)->toDateString();
        $listing = PrivateSeat::with('stops', 'owner.driverProfile')->where('active', true)->findOrFail($id);
        abort_if($listing->date && $listing->date !== $date, 404, 'This journey does not run on that date.');
        $used = SegmentSeats::used($listing, $date);
        $stops = $listing->stops->isNotEmpty() ? $listing->stops->map(fn ($s) => ['seq' => $s->seq, 'name' => $s->name, 'time' => $s->time, 'fare_to_next' => $s->fare_to_next])->all()
            : [['seq' => 0, 'name' => $listing->from, 'time' => (string) $listing->dep, 'fare_to_next' => (int) $listing->price], ['seq' => 1, 'name' => $listing->to, 'time' => null, 'fare_to_next' => null]];

        return response()->json([
            'id' => $listing->id, 'date' => $date, 'seats' => (int) $listing->seats,
            'driver' => ['name' => $listing->driver, 'rating' => (float) ($listing->owner?->driverProfile?->rating_avg ?? 0)],
            'stops' => $stops,
            'seats_left_per_segment' => array_map(fn ($u) => max(0, (int) $listing->seats - $u), $used),
            'pickup_station' => $listing->pickup_station, 'drop_location' => $listing->drop_location,
            'allow_custom_pickup' => (bool) $listing->allow_custom_pickup, 'custom_pickup_fee' => (int) ($listing->custom_pickup_fee ?? 0),
            'amenities' => $listing->amenities ?? [], 'notes' => $listing->notes,
        ]);
    }
}
