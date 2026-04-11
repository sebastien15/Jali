<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use Illuminate\Http\Request;

class AdminBookingController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Booking::with("user")->orderBy("created_at", "desc");

        // Station admin only sees bookings for their city
        if ($user->isAdmin() && !$user->isSuperAdmin()) {
            $station = $user->adminStation;
            if ($station) {
                $query->whereHas("bookable", function ($q) use ($station) {
                    $q->where("from", $station->city)->orWhere(
                        "to",
                        $station->city,
                    );
                });
            }
        }

        if ($request->has("status")) {
            $query->where("status", $request->status);
        }

        $bookings = $query->get()->map(function ($b) {
            return [
                "id" => $b->id,
                "type" => $b->type,
                "title" => $b->title,
                "sub" => $b->sub,
                "price" => $b->price,
                "service_fee" => $b->service_fee,
                "status" => $b->status,
                "ticket_photo_url" => $b->ticket_photo_url,
                "user_name" => $b->user?->name,
                "user_email" => $b->user?->email,
                "created_at" => $b->created_at,
            ];
        });

        return response()->json($bookings);
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        $booking = Booking::with("bookable")->findOrFail($id);

        // Station admin can only update bookings for their city
        if ($user->isAdmin() && !$user->isSuperAdmin()) {
            $station = $user->adminStation;
            if ($station) {
                $fromCity = $booking->bookable?->from ?? null;
                $toCity = $booking->bookable?->to ?? null;
                if (
                    $fromCity !== $station->city &&
                    $toCity !== $station->city
                ) {
                    abort(
                        403,
                        "You can only manage bookings for your assigned city.",
                    );
                }
            } else {
                abort(403, "No station assigned to your account.");
            }
        }

        $data = $request->validate([
            "status" => "sometimes|in:pending,confirmed,completed",
            "ticket_photo_url" => "sometimes|nullable|string|url",
        ]);

        $booking->update($data);
        return response()->json($booking);
    }
}
