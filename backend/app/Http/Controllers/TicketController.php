<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Services\PushService;
use Illuminate\Http\Request;

class TicketController extends Controller
{
    public function upload(Request $request, PushService $push, $id)
    {
        $user = $request->user();

        // Only admins can upload tickets
        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Forbidden', 'message' => 'Only admins can upload tickets'], 403);
        }

        $validated = $request->validate([
            'ticket_photo_url' => 'required|url',
        ]);

        $booking = Booking::findOrFail($id);

        $booking->update([
            'ticket_photo_url' => $validated['ticket_photo_url'],
            'status' => 'confirmed',
        ]);

        $push->send(
            $booking->user,
            'Your ticket is ready',
            'Tap to view your ticket for your trip',
            ['screen' => 'booking', 'id' => $booking->id],
        );

        return response()->json([
            'data' => $booking,
            'message' => 'Ticket uploaded and booking confirmed',
        ]);
    }
}
