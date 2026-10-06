<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\DriverProfile;
use App\Models\PrivateSeat;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

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
     * Driver profile, active vehicle and all vehicles of the authenticated user.
     */
    public function profile(Request $request)
    {
        return response()->json($this->profilePayload($request->user()));
    }

    /**
     * PATCH /driver/profile
     * Saves what driver/setup.tsx collects: display name, FCM token, operating zones,
     * documents link and the active vehicle (created on first save).
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();
        $vehicle = $user->vehicles()->where('is_active', true)->first();

        if ($request->filled('plate')) {
            $request->merge(['plate' => Vehicle::normalizePlate($request->input('plate'))]);
        }

        $validated = $request->validate([
            'name'             => 'sometimes|string|max:255',
            'fcm_token'        => 'sometimes|string',
            'services'         => 'sometimes|array',
            'services.*'       => 'string|distinct|in:ride,hire,private_seat,rental',
            'allowed_zones'    => 'sometimes|array',
            'allowed_zones.*'  => 'string|max:100',
            'docs_url'         => 'sometimes|nullable|url|max:2048',
            // Vehicle — model and plate are required together the first time a vehicle is saved
            'car_model'        => [$vehicle ? 'sometimes' : 'required_with:plate', 'string', 'max:100'],
            'plate'            => [$vehicle ? 'sometimes' : 'required_with:car_model', 'string', 'max:20',
                                   Rule::unique('vehicles', 'plate')->ignore($vehicle?->id)],
            'car_type'         => 'sometimes|string|in:Sedan,SUV,Minivan,Pickup',
            'seats'            => 'sometimes|integer|min:1|max:60',
            'amenities'        => 'sometimes|array',
            'amenities.*'      => 'string|max:50',
            'insurance_expiry' => 'sometimes|nullable|date_format:Y-m-d',
            'price_day'        => 'sometimes|nullable|integer|min:0',
            'caution'          => 'sometimes|nullable|integer|min:0',
        ], [
            'plate.unique'                 => 'This plate number is already registered on Jali.',
            'insurance_expiry.date_format' => 'Use the format YYYY-MM-DD, e.g. 2026-12-31.',
        ]);

        DB::transaction(function () use ($user, $vehicle, $validated) {
            $user->update(array_intersect_key($validated, array_flip(['name', 'fcm_token'])));

            $profileData = array_intersect_key($validated, array_flip(['services', 'allowed_zones', 'docs_url']));
            $profile = $user->driverProfile()->firstOrCreate([]);
            if ($profileData) {
                $profile->update($profileData);
            }

            $vehicleData = $this->vehicleAttributes($validated);
            if ($vehicle && $vehicleData) {
                $vehicle->update($vehicleData);
            } elseif (!$vehicle && isset($vehicleData['model'], $vehicleData['plate'])) {
                $user->vehicles()->create($vehicleData + ['is_active' => true]);
            }
        });

        return response()->json($this->profilePayload($user->fresh()));
    }

    /** Maps the setup screen's field names onto vehicle columns. */
    private function vehicleAttributes(array $validated): array
    {
        $map = [
            'car_model'        => 'model',
            'plate'            => 'plate',
            'car_type'         => 'body_type',
            'seats'            => 'seats',
            'amenities'        => 'amenities',
            'insurance_expiry' => 'insurance_expiry',
            'price_day'        => 'rental_price_day',
            'caution'          => 'rental_caution',
        ];

        $attributes = [];
        foreach ($map as $input => $column) {
            if (array_key_exists($input, $validated)) {
                $attributes[$column] = $validated[$input];
            }
        }
        if (isset($attributes['body_type'])) {
            $attributes['class'] = $attributes['body_type'] === 'Minivan' ? 'van' : 'car';
        }

        return $attributes;
    }

    private function profilePayload(User $user): array
    {
        $user->loadMissing('driverProfile', 'vehicles');
        $profile = $user->driverProfile;

        return [
            'user' => [
                'id'    => $user->id,
                'name'  => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
            ],
            'profile' => $profile ? [
                'services'            => $profile->services ?? [],
                'allowed_zones'       => $profile->allowed_zones ?? [],
                'docs_url'            => $profile->docs_url,
                'verification_status' => $profile->verification_status ?? DriverProfile::STATUS_PENDING,
                'rating_avg'          => $profile->rating_avg,
                'trips_count'         => $profile->trips_count,
            ] : null,
            'vehicle'  => $user->vehicles->firstWhere('is_active', true),
            'vehicles' => $user->vehicles->values(),
        ];
    }
}
