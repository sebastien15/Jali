<?php

namespace App\Modules\SharedJourneys\Application;

use App\Models\PrivateSeat;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/** Public private-seat catalogue (GET /private-seats). */
class SeatCatalogue
{
    /**
     * Active listings with seats left, by departure time, 10 per page.
     * Each filter is the raw request value, or null when the request did not fill it.
     * No stop/segment capacity is modelled: `seats` is per listing.
     */
    public function search(mixed $from = null, mixed $to = null, mixed $date = null): LengthAwarePaginator
    {
        $query = PrivateSeat::query()->with('stops')->where('seats', '>', 0)->where('active', true);

        if ($from !== null) {
            $query->where('from', $from);
        }

        if ($to !== null) {
            $query->where('to', $to);
        }

        if ($date !== null && ($date = ListingDate::normalize($date))) {
            // Listings without a date run every day.
            $query->where(fn ($q) => $q->whereNull('date')->orWhere('date', $date));
        }

        return $query->orderBy('dep')->paginate(10);
    }
}
