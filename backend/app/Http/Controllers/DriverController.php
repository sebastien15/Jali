<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\PrivateSeat;
use Illuminate\Http\Request;

class DriverController extends Controller
{
    /**
     * GET /driver/stats
     * Returns today's and this week's earnings + trip counts for the authenticated driver.
     */
    public function stats(Request $request)
    {
        $user = $request->user();

        // IDs of all listings owned by this driver
        $listingIds = PrivateSeat::where('user_id', $user->id)->pluck('id');

        $bookingsQuery = Booking::where('type', 'private')
            ->whereIn('reference_id', $listingIds)
            ->where('status', '!=', 'cancelled');

        $today     = now()->toDateString();
        $weekStart = now()->startOfWeek()->toDateString();

        $todayBookings = (clone $bookingsQuery)->whereDate('created_at', $today)->get();
        $weekBookings  = (clone $bookingsQuery)->whereDate('created_at', '>=', $weekStart)->get();

        // Driver earns price minus service_fee (service_fee split goes to platform + station)
        $todayEarnings = $todayBookings->sum(fn($b) => $b->price - $b->service_fee);
        $weekEarnings  = $weekBookings->sum(fn($b) => $b->price - $b->service_fee);

        // Average rating from driver's listings
        $rating = PrivateSeat::where('user_id', $user->id)->avg('rating') ?? 0;

        return response()->json([
            'todayEarnings' => $todayEarnings,
            'todayTrips'    => $todayBookings->count(),
            'rating'        => round($rating, 1),
            'weekEarnings'  => $weekEarnings,
            'weekTrips'     => $weekBookings->count(),
        ]);
    }

    /**
     * GET /driver/trips
     * Returns bookings made on the driver's listings, shaped for the Drive dashboard.
     */
    public function trips(Request $request)
    {
        $user = $request->user();

        $listingIds = PrivateSeat::where('user_id', $user->id)->pluck('id');

        $bookings = Booking::with('user')
            ->where('type', 'private')
            ->whereIn('reference_id', $listingIds)
            ->latest()
            ->get();

        $trips = $bookings->map(function ($booking) {
            $seat = PrivateSeat::find($booking->reference_id);
            return [
                'id'      => $booking->id,
                'from'    => $seat?->from ?? '—',
                'to'      => $seat?->to ?? '—',
                'dep'     => $seat?->dep ?? '—',
                'date'    => $booking->travel_date ?? $booking->created_at->toDateString(),
                'pax'     => 1, // one seat per booking
                'earning' => $booking->price - $booking->service_fee,
                'status'  => $booking->status === 'confirmed' ? 'upcoming' : $booking->status,
            ];
        });

        return response()->json($trips);
    }

    /**
     * PATCH /driver/profile
     * Updates the driver's display name and optionally their FCM token.
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name'      => 'sometimes|string|max:255',
            'fcm_token' => 'sometimes|string',
        ]);

        $user->update($validated);

        return response()->json($user->fresh());
    }
}
