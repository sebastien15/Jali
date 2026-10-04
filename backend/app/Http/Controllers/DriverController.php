<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\PrivateSeat;
use Illuminate\Http\Request;

class DriverController extends Controller
{
    /**
     * Bookings on the driver's private-seat listings that still count.
     */
    private function listingBookings(Request $request)
    {
        $listingIds = PrivateSeat::where('user_id', $request->user()->id)->pluck('id');

        return Booking::where('type', 'private')
            ->whereIn('reference_id', $listingIds)
            ->where('status', '!=', 'cancelled');
    }

    /**
     * GET /driver/stats
     * Returns today's and this week's earnings + trip counts for the authenticated driver.
     */
    public function stats(Request $request)
    {
        $user = $request->user();
        $bookingsQuery = $this->listingBookings($request);

        $today     = now()->toDateString();
        $weekStart = now()->startOfWeek()->toDateString();

        $todayBookings = (clone $bookingsQuery)->whereDate('created_at', $today)->get();
        $weekBookings  = (clone $bookingsQuery)->whereDate('created_at', '>=', $weekStart)->get();

        // `price` is the seat fare the driver receives; the service fee is
        // charged on top to the passenger and is never part of the fare.
        $rating = PrivateSeat::where('user_id', $user->id)->avg('rating') ?? 0;

        return response()->json([
            'todayEarnings' => (int) $todayBookings->sum('price'),
            'todayTrips'    => $todayBookings->count(),
            'rating'        => round($rating, 1),
            'weekEarnings'  => (int) $weekBookings->sum('price'),
            'weekTrips'     => $weekBookings->count(),
        ]);
    }

    /**
     * GET /driver/trips
     * Returns bookings made on the driver's listings, shaped for the Drive dashboard.
     */
    public function trips(Request $request)
    {
        $listingIds = PrivateSeat::where('user_id', $request->user()->id)->pluck('id');
        $seats = PrivateSeat::whereIn('id', $listingIds)->get()->keyBy('id');

        $bookings = Booking::where('type', 'private')
            ->whereIn('reference_id', $listingIds)
            ->latest()
            ->get();

        $trips = $bookings->map(function ($booking) use ($seats) {
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

        return response()->json($trips);
    }

    /**
     * GET /driver/profile
     */
    public function profile(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'name'    => $user->name,
            'phone'   => $user->phone,
            'profile' => $user->driver_profile ?? (object) [],
        ]);
    }

    /**
     * PATCH /driver/profile
     * Updates the driver's name, FCM token and vehicle/onboarding details.
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name'             => 'sometimes|string|max:255',
            'fcm_token'        => 'sometimes|string|max:4096',
            'car_model'        => 'sometimes|nullable|string|max:100',
            'plate'            => 'sometimes|nullable|string|max:20',
            'seats'            => 'sometimes|nullable|integer|min:1|max:60',
            'car_type'         => 'sometimes|nullable|string|max:30',
            'price_day'        => 'sometimes|nullable|integer|min:0',
            'caution'          => 'sometimes|nullable|integer|min:0',
            'insurance_expiry' => 'sometimes|nullable|string|max:30',
            'allowed_zones'    => 'sometimes|nullable|array|max:20',
            'allowed_zones.*'  => 'string|max:100',
            'docs_url'         => 'sometimes|nullable|url|max:2048',
            'amenities'        => 'sometimes|nullable|array|max:30',
            'amenities.*'      => 'string|max:50',
        ]);

        $profileKeys = ['car_model', 'plate', 'seats', 'car_type', 'price_day', 'caution',
            'insurance_expiry', 'allowed_zones', 'docs_url', 'amenities'];
        $profile = array_intersect_key($validated, array_flip($profileKeys));

        $user->fill(array_intersect_key($validated, array_flip(['name', 'fcm_token'])));
        if ($profile) {
            $user->forceFill(['driver_profile' => array_merge($user->driver_profile ?? [], $profile)]);
        }
        $user->save();

        return response()->json($this->profile($request)->getData(true));
    }
}
