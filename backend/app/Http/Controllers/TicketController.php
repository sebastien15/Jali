<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\User;
use Illuminate\Http\Request;
use Kreait\Firebase\Factory;

class TicketController extends Controller
{
    public function upload(Request $request, $id)
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

        // Send FCM push notification to user
        $this->sendPushNotification($booking->user, 'Your ticket is ready', 'Tap to view your ticket for your trip');

        return response()->json([
            'data' => $booking,
            'message' => 'Ticket uploaded and booking confirmed',
        ]);
    }

    /**
     * Send FCM push notification to a user
     */
    private function sendPushNotification(User $user, string $title, string $body): void
    {
        if (!$user->fcm_token) {
            return;
        }

        try {
            $factory = (new Factory)
                ->withServiceAccount(config('firebase.projects.app.credentials'));

            $messaging = $factory->createMessaging();

            $message = [
                'token' => $user->fcm_token,
                'notification' => [
                    'title' => $title,
                    'body' => $body,
                ],
            ];

            $messaging->send($message);
        } catch (\Exception $e) {
            // Log error but don't fail the request
            \Log::error('FCM push notification failed: ' . $e->getMessage());
        }
    }
}
