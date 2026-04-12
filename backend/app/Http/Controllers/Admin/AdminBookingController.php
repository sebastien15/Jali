<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Booking;
use Illuminate\Http\Request;

class AdminBookingController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Booking::with(['user', 'trip.agency', 'trip.fromStation', 'trip.toStation', 'confirmedBy'])
            ->orderBy('created_at', 'desc');

        // Station admin only sees bookings for trips departing from their station
        if ($user->isAdmin() && !$user->isSuperAdmin()) {
            $station = $user->adminStation;
            if ($station) {
                $query->where(function ($q) use ($station) {
                    // For trip bookings: filter by from_station_id of the trip
                    $q->where(function ($sq) use ($station) {
                        $sq->where('type', 'trip')
                            ->whereHas('trip', fn($tq) => $tq->where('from_station_id', $station->id));
                    })
                    // For legacy bus bookings: filter by title containing station city
                    ->orWhere(function ($sq) use ($station) {
                        $sq->where('type', 'bus')
                            ->where('title', 'like', "%{$station->city}%");
                    });
                });
            } else {
                return response()->json([]);
            }
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $bookings = $query->get()->map(function ($b) {
            return [
                'id'                => $b->id,
                'type'              => $b->type,
                'title'             => $b->title,
                'sub'               => $b->sub,
                'price'             => $b->price,
                'service_fee'       => $b->service_fee,
                'total'             => $b->price + $b->service_fee,
                'status'            => $b->status,
                'payment_method'    => $b->payment_method,
                'travel_date'       => $b->travel_date,
                'ticket_photo_url'  => $b->ticket_photo_url,
                'user_name'         => $b->user?->name,
                'user_email'        => $b->user?->email,
                'user_phone'        => $b->user?->phone,
                'confirmed_by_name' => $b->confirmedBy?->name,
                'confirmed_at'      => $b->confirmed_at,
                'created_at'        => $b->created_at,
                // Trip-specific
                'trip_departure'    => $b->trip?->departure_time,
                'trip_arrival'      => $b->trip?->estimated_arrival_time,
                'agency_name'       => $b->trip?->agency?->name,
            ];
        });

        return response()->json($bookings);
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        $booking = Booking::findOrFail($id);

        // Station admin can only manage bookings for their station
        if ($user->isAdmin() && !$user->isSuperAdmin()) {
            $station = $user->adminStation;
            if ($station) {
                // For trip bookings: check if the trip departs from admin's station
                if ($booking->type === 'trip' && $booking->trip) {
                    if ($booking->trip->from_station_id !== $station->id) {
                        abort(403, 'You can only manage bookings for your assigned station.');
                    }
                }
                // For legacy bus bookings: check title contains city
                elseif ($booking->type === 'bus') {
                    if (stripos($booking->title, $station->city) === false) {
                        abort(403, 'You can only manage bookings for your assigned city.');
                    }
                }
            } else {
                abort(403, 'No station assigned to your account.');
            }
        }

        $data = $request->validate([
            'status' => 'sometimes|in:pending,confirmed,completed,cancelled,taken,ticket_ready,delivered',
            'ticket_photo_url' => 'sometimes|nullable|string|url',
        ]);

        // When status changes to confirmed, set confirmed_by and confirmed_at
        if (isset($data['status']) && $data['status'] === 'confirmed') {
            $data['confirmed_by'] = $user->id;
            $data['confirmed_at'] = now();

            ActivityLog::create([
                'admin_id'    => $user->id,
                'action'      => 'booking_confirmed',
                'entity_type' => 'booking',
                'entity_id'   => $booking->id,
                'details'     => [
                    'title' => $booking->title,
                    'user'  => $booking->user?->name,
                ],
            ]);
        }

        $booking->update($data);
        return response()->json($booking);
    }
}
