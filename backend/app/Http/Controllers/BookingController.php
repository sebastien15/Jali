<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Bus;
use App\Models\CarRental;
use App\Models\PrivateSeat;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->auth_user;

        $query = Booking::query()->where('user_id', $user->id);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $bookings = $query->orderBy('created_at', 'desc')->get();

        // Transform to match mobile Trip interface
        $trips = $bookings->map(function ($booking) {
            return [
                'id' => $booking->id,
                'type' => $booking->type,
                'title' => $booking->title,
                'sub' => $booking->sub,
                'price' => $booking->price + $booking->service_fee,
                'status' => $booking->status,
                'ticket_photo_url' => $booking->ticket_photo_url,
            ];
        });

        return response()->json($trips);
    }

    public function store(Request $request)
    {
        $user = $request->auth_user;

        $validated = $request->validate([
            'type'           => 'required|in:bus,private,rental',
            'reference_id'   => 'required|integer',
            'price'          => 'required|integer|min:0',
            'service_fee'    => 'required|integer|min:0',
            'payment_method' => 'required|string',
            'title'          => 'nullable|string',
            'sub'            => 'nullable|string',
            'travel_date'    => 'nullable|string',
        ]);

        $type    = $validated['type'];
        $itemId  = $validated['reference_id'];

        // Fetch the referenced item for server-side title generation if not provided
        if (empty($validated['title'])) {
            $item = match ($type) {
                'bus'     => Bus::find($itemId),
                'private' => PrivateSeat::find($itemId),
                'rental'  => CarRental::find($itemId),
            };

            if (!$item) {
                return response()->json(['error' => 'Item not found'], 404);
            }

            $validated['title'] = match ($type) {
                'bus'     => "{$item->agency} · {$item->from} → {$item->to}",
                'private' => "{$item->driver} · {$item->from} → {$item->to}",
                'rental'  => "{$item->name} ({$item->type})",
            };
            $validated['sub'] = match ($type) {
                'bus'     => "Departs {$item->dep} · {$item->seats} seats",
                'private' => "Departs {$item->dep}",
                'rental'  => "{$item->plate} · {$item->seats} seats",
            };
        }

        $booking = Booking::create([
            'user_id'        => $user->id,
            'type'           => $type,
            'reference_id'   => $itemId,
            'title'          => $validated['title'],
            'sub'            => $validated['sub'] ?? '',
            'price'          => $validated['price'],
            'service_fee'    => $validated['service_fee'],
            'status'         => 'pending',
            'payment_method' => $validated['payment_method'],
        ]);

        return response()->json([
            'id' => $booking->id,
            'type' => $booking->type,
            'title' => $booking->title,
            'sub' => $booking->sub,
            'price' => $booking->price + $booking->service_fee,
            'status' => $booking->status,
            'message' => 'Booking created successfully',
        ], 201);
    }

    public function show(Request $request, $id)
    {
        $user = $request->auth_user;

        $booking = Booking::findOrFail($id);

        // Users can only view their own bookings
        if ($booking->user_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        return response()->json([
            'id' => $booking->id,
            'type' => $booking->type,
            'title' => $booking->title,
            'sub' => $booking->sub,
            'price' => $booking->price + $booking->service_fee,
            'status' => $booking->status,
            'ticket_photo_url' => $booking->ticket_photo_url,
        ]);
    }

    public function confirm(Request $request, $id)
    {
        $user = $request->auth_user;

        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $booking = Booking::findOrFail($id);
        $booking->update(['status' => 'confirmed']);

        return response()->json([
            'id' => $booking->id,
            'type' => $booking->type,
            'title' => $booking->title,
            'sub' => $booking->sub,
            'price' => $booking->price + $booking->service_fee,
            'status' => $booking->status,
            'ticket_photo_url' => $booking->ticket_photo_url,
        ]);
    }
}
