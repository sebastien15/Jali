<?php

namespace App\Modules\SharedJourneys\Application;

use App\Models\Booking;
use App\Models\PrivateSeat;

/**
 * Seats per route segment (S25.2): segment k runs from stop k to stop k+1.
 * A seat from stop a to stop b occupies segments a..b-1 only. Legacy whole-route
 * bookings (/bookings type=private) occupy every segment.
 */
class SegmentSeats
{
    /** Seats used on each segment for one date: [segment => seats] */
    public static function used(PrivateSeat $listing, string $date): array
    {
        $segments = max(1, $listing->stops->count() - 1);
        $legacy = (int) Booking::where('type', 'private')->where('reference_id', $listing->id)
            ->where('status', '!=', 'cancelled')->where('travel_date', $date)->sum('quantity');
        $used = array_fill(0, $segments, $legacy);
        foreach (self::journeyBookings($listing, $date) as [$from, $to, $seats]) {
            for ($k = $from; $k < $to && $k < $segments; $k++) {
                $used[$k] += $seats;
            }
        }

        return $used;
    }

    /** Seats still free on every segment between stops $from and $to */
    public static function left(PrivateSeat $listing, string $date, int $from, int $to): int
    {
        $used = self::used($listing, $date);
        $max = 0;
        for ($k = $from; $k < $to; $k++) {
            $max = max($max, $used[$k] ?? 0);
        }

        return max(0, (int) $listing->seats - $max);
    }

    /**
     * Seat requests holding seats (S25.4 adds them). Each item: [fromSeq, toSeq, seats].
     *
     * @return iterable<array{0:int,1:int,2:int}>
     */
    protected static function journeyBookings(PrivateSeat $listing, string $date): iterable
    {
        if (!class_exists(\App\Models\JourneySeat::class)) {
            return [];
        }

        return \App\Models\JourneySeat::where('private_seat_id', $listing->id)->where('travel_date', $date)
            ->whereIn('status', \App\Models\JourneySeat::HOLDING)->get(['from_seq', 'to_seq', 'seats'])
            ->map(fn ($s) => [(int) $s->from_seq, (int) $s->to_seq, (int) $s->seats])->all();
    }
}
