<?php

namespace App\Modules\SharedJourneys\Application;

use App\Models\Booking;
use App\Models\PrivateSeat;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Provider-side read model over bookings made on a driver's private-seat
 * listings (GET /driver/stats, GET /driver/trips). Private seats only —
 * rentals, rides and hires are not counted here.
 */
class ListingActivity
{
    /** Bookings on the driver's private-seat listings that still count. */
    private function listingBookings(User $driver): Builder
    {
        $listingIds = PrivateSeat::where('user_id', $driver->id)->pluck('id');

        return Booking::where('type', 'private')
            ->whereIn('reference_id', $listingIds)
            ->where('status', '!=', 'cancelled');
    }

    /** Today's and this week's earnings + trip counts. */
    public function stats(User $driver): array
    {
        $bookingsQuery = $this->listingBookings($driver);

        $today     = now()->toDateString();
        $weekStart = now()->startOfWeek()->toDateString();

        $todayBookings = (clone $bookingsQuery)->whereDate('created_at', $today)->get();
        $weekBookings  = (clone $bookingsQuery)->whereDate('created_at', '>=', $weekStart)->get();

        // `price` is the seat fare the driver receives; the service fee is
        // charged on top to the passenger and is never part of the fare.
        $rating = PrivateSeat::where('user_id', $driver->id)->avg('rating') ?? 0;

        return [
            'todayEarnings' => (int) $todayBookings->sum('price'),
            'todayTrips'    => $todayBookings->count(),
            'rating'        => round($rating, 1),
            'weekEarnings'  => (int) $weekBookings->sum('price'),
            'weekTrips'     => $weekBookings->count(),
        ];
    }

    /** Bookings made on the driver's listings, shaped for the Drive dashboard. */
    public function trips(User $driver): Collection
    {
        $listingIds = PrivateSeat::where('user_id', $driver->id)->pluck('id');
        $seats = PrivateSeat::whereIn('id', $listingIds)->get()->keyBy('id');

        $bookings = Booking::where('type', 'private')
            ->whereIn('reference_id', $listingIds)
            ->latest()
            ->get();

        return $bookings->map(function ($booking) use ($seats) {
            $seat = $seats->get($booking->reference_id);
            return [
                'id'      => $booking->id,
                'from'    => $seat?->from ?? '—',
                'to'      => $seat?->to ?? '—',
                'dep'     => $seat?->dep ?? '—',
                'date'    => $booking->travel_date ?? $booking->created_at->toDateString(),
                'pax'     => (int) ($booking->quantity ?? 1),
                'earning' => (int) $booking->price,
                // Drive tab splits on "upcoming" vs everything else (history).
                'status'  => match ($booking->status) {
                    'pending', 'taken', 'ticket_ready' => 'upcoming',
                    'delivered' => 'completed',
                    default => $booking->status,
                },
            ];
        });
    }
}
