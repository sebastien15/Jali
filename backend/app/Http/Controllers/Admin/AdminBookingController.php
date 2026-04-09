<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use Illuminate\Http\Request;

class AdminBookingController extends Controller
{
    public function index(Request $request)
    {
        $user  = $request->auth_user;
        $query = Booking::with('user')->orderBy('created_at', 'desc');

        // Station admin only sees bookings for their city
        if ($user->isAdmin() && !$user->isSuperAdmin()) {
            $station = $user->adminStation;
            if ($station) {
                $query->whereHas('bookable', function ($q) use ($station) {
                    $q->where('from', $station->city)->orWhere('to', $station->city);
                });
            }
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $bookings = $query->get()->map(function ($b) {
            return [
                'id'               => $b->id,
                'type'             => $b->type,
                'title'            => $b->title,
                'sub'              => $b->sub,
                'price'            => $b->price,
                'service_fee'      => $b->service_fee,
                'status'           => $b->status,
                'ticket_photo_url' => $b->ticket_photo_url,
                'user_name'        => $b->user?->name,
                'user_email'       => $b->user?->email,
                'created_at'       => $b->created_at,
            ];
        });

        return response()->json($bookings);
    }

    public function update(Request $request, $id)
    {
        $booking = Booking::findOrFail($id);

        $data = $request->validate([
            'status'           => 'sometimes|in:pending,confirmed,completed',
            'ticket_photo_url' => 'sometimes|nullable|string|url',
        ]);

        $booking->update($data);
        return response()->json($booking);
    }
}
