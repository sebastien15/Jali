<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\AdminStation;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminBookingController extends Controller
{
    private const ACTIONS = [
        'taken'        => 'booking_claimed',
        'ticket_ready' => 'ticket_uploaded',
        'delivered'    => 'booking_delivered',
        'cancelled'    => 'booking_cancelled',
    ];

    public function index(Request $request)
    {
        $user = $request->user();
        if ($denied = $this->denyIfNoStation($user)) {
            return $denied;
        }

        $query = Booking::with(['user', 'departure.route.agency', 'confirmedBy'])
            ->manageableBy($user)
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $bookings = $query->get()->map(function ($b) {
            $route = $b->departure?->route;
            return [
                'id'                => $b->id,
                'type'              => $b->type,
                'title'             => $b->title,
                'sub'               => $b->sub,
                'price'             => $b->price,
                'service_fee'       => $b->service_fee,
                'total'             => $b->price + $b->service_fee,
                'quantity'          => $b->quantity ?? 1,
                'passenger_names'   => $b->passenger_names ?? [],
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
                'trip_departure'    => $b->departure ? substr($b->departure->departure_time, 0, 5) : null,
                'trip_arrival'      => $b->departure && $route ? $b->departure->estimatedArrival() : null,
                'agency_name'       => $route?->agency?->name,
            ];
        });

        return response()->json($bookings);
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        $booking = $this->findManageable($user, $id);

        $data = $request->validate([
            'status' => 'sometimes|in:taken,ticket_ready,delivered,cancelled',
            'ticket_photo_url' => 'sometimes|nullable|string|url|max:2048',
        ]);

        $status = $data['status'] ?? null;
        $extra = array_key_exists('ticket_photo_url', $data) ? ['ticket_photo_url' => $data['ticket_photo_url']] : [];

        if ($status === null) {
            // Ticket URL edits are only meaningful once the booking has been claimed.
            if ($extra && in_array($booking->status, ['taken', 'ticket_ready'], true)) {
                $booking->update($extra);
            } elseif ($extra) {
                return response()->json(['message' => 'Claim the booking before adding a ticket.'], 422);
            }
            return response()->json($booking->fresh());
        }

        if ($status === 'ticket_ready' && empty($extra['ticket_photo_url'] ?? $booking->ticket_photo_url)) {
            return response()->json(['message' => 'Upload a ticket before marking it ready.'], 422);
        }

        return $this->transition($booking, $status, $user, $extra);
    }

    public function uploadTicket(Request $request, $id)
    {
        $user = $request->user();
        $booking = $this->findManageable($user, $id);

        $request->validate([
            'ticket' => 'required|file|max:16384|mimes:jpg,jpeg,png,webp,heic,heif', // 16MB
        ]);

        if (!$booking->canTransitionTo('ticket_ready')) {
            return response()->json(['message' => "Cannot upload a ticket for a {$booking->status} booking."], 422);
        }

        $path = $request->file('ticket')->store('tickets', 'public');
        $url = Storage::url($path);

        $response = $this->transition($booking, 'ticket_ready', $user, ['ticket_photo_url' => $url]);
        if ($response->getStatusCode() !== 200) {
            Storage::disk('public')->delete($path);
            return $response;
        }

        return response()->json([
            'ticket_photo_url' => $url,
            'status'           => 'ticket_ready',
        ]);
    }

    private function transition(Booking $booking, string $status, User $user, array $extra = [])
    {
        $from = $booking->status;
        if (!$booking->transitionTo($status, $user, $extra)) {
            $current = $booking->fresh()->status;
            $message = $current !== $from
                ? 'This booking was just updated by someone else.'
                : "Cannot change a {$from} booking to {$status}.";
            return response()->json(['message' => $message], 422);
        }

        ActivityLog::create([
            'admin_id'    => $user->id,
            'action'      => self::ACTIONS[$status] ?? 'booking_updated',
            'entity_type' => 'booking',
            'entity_id'   => $booking->id,
            'details'     => [
                'title' => $booking->title,
                'from'  => $from,
                'to'    => $status,
            ],
        ]);

        return response()->json($booking);
    }

    private function findManageable(User $user, $id): Booking
    {
        if ($user->isSuperAdmin() === false && !AdminStation::where('user_id', $user->id)->exists()) {
            abort(403, 'No station assigned to your account.');
        }

        $booking = Booking::findOrFail($id);
        if (!$booking->isManageableBy($user)) {
            abort(403, 'You can only manage bookings for your assigned station.');
        }
        return $booking;
    }

    private function denyIfNoStation(User $user)
    {
        if (!$user->isSuperAdmin() && !AdminStation::where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'No station assigned to your account.'], 403);
        }
        return null;
    }
}
