<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\LegacyBookings\Application\AdminBookingQueue;
use App\Modules\LegacyBookings\Application\BookingTransitionRefused;
use Illuminate\Http\Request;

/** Transport adapter for LegacyBookings (runbook M03-Bus): validation + HTTP shape only. */
class AdminBookingController extends Controller
{
    public function __construct(private readonly AdminBookingQueue $queue)
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$this->queue->hasStation($user)) {
            return response()->json(['message' => 'No station assigned to your account.'], 403);
        }

        return response()->json($this->queue->queue($user, $request->filled('status') ? (string) $request->status : null));
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        // Station/scope (403) and lookup (404) win over validation, as before.
        $booking = $this->queue->findManageable($user, $id);

        $data = $request->validate([
            'status' => 'sometimes|in:taken,ticket_ready,delivered,cancelled',
            'ticket_photo_url' => 'sometimes|nullable|string|url|max:2048',
        ]);

        $extra = array_key_exists('ticket_photo_url', $data) ? ['ticket_photo_url' => $data['ticket_photo_url']] : [];

        try {
            return response()->json($this->queue->update($booking, $user, $data['status'] ?? null, $extra));
        } catch (BookingTransitionRefused $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function uploadTicket(Request $request, $id)
    {
        $user = $request->user();
        $booking = $this->queue->findManageable($user, $id);

        $request->validate([
            'ticket' => 'required|file|max:16384|mimes:jpg,jpeg,png,webp,heic,heif', // 16MB
        ]);

        try {
            $url = $this->queue->attachTicket($booking, $request->file('ticket'), $user);
        } catch (BookingTransitionRefused $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'ticket_photo_url' => $url,
            'status'           => 'ticket_ready',
        ]);
    }
}
