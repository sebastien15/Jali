<?php

namespace App\Modules\LegacyBookings\Application;

use App\Models\ActivityLog;
use App\Models\AdminStation;
use App\Models\Booking;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

/**
 * The admin side of generic `bookings`: the station queue, claim, ticket and
 * status changes (/admin/bookings/** and the legacy /bookings/{id}/claim,
 * /ticket, /deliver). Scope is Booking::manageableBy — superadmins see all,
 * station admins only their station(s), admins without a station nothing.
 * Never widen it here (runbook §2). Every status change goes through
 * Booking::transitionTo (the one conditional writer) and is logged.
 */
class AdminBookingQueue
{
    private const ACTIONS = [
        'taken'        => 'booking_claimed',
        'ticket_ready' => 'ticket_uploaded',
        'delivered'    => 'booking_delivered',
        'cancelled'    => 'booking_cancelled',
    ];

    /** Superadmin, or an admin with at least one assigned station. */
    public function hasStation(User $user): bool
    {
        return $user->isSuperAdmin() || AdminStation::where('user_id', $user->id)->exists();
    }

    /** The admin's queue, newest first. */
    public function queue(User $user, ?string $status): Collection
    {
        $query = Booking::with(['user', 'departure.route.agency', 'confirmedBy'])
            ->manageableBy($user)
            ->orderBy('created_at', 'desc');

        if ($status !== null) {
            $query->where('status', $status);
        }

        return $query->get()->map(function ($b) {
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
    }

    /** /admin/bookings/{id}: 403 without a station or outside scope, 404 when missing. */
    public function findManageable(User $user, int|string $id): Booking
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

    /** Legacy /bookings/{id}/*: null when missing or outside the admin's scope (both answer 404). */
    public function findManageableOrNull(User $user, int|string $id): ?Booking
    {
        $booking = Booking::find($id);

        return $booking && $booking->isManageableBy($user) ? $booking : null;
    }

    /**
     * PATCH /admin/bookings/{id}: a status change and/or a ticket URL edit.
     *
     * @param array $extra ['ticket_photo_url' => ?string] when sent
     * @throws BookingTransitionRefused
     */
    public function update(Booking $booking, User $user, ?string $status, array $extra): Booking
    {
        if ($status === null) {
            // Ticket URL edits are only meaningful once the booking has been claimed.
            if ($extra && in_array($booking->status, ['taken', 'ticket_ready'], true)) {
                $booking->update($extra);
            } elseif ($extra) {
                throw new BookingTransitionRefused('Claim the booking before adding a ticket.');
            }
            return $booking->fresh();
        }

        if ($status === 'ticket_ready' && empty($extra['ticket_photo_url'] ?? $booking->ticket_photo_url)) {
            throw new BookingTransitionRefused('Upload a ticket before marking it ready.');
        }

        return $this->transition($booking, $status, $user, $extra);
    }

    /**
     * Store the ticket image on the public disk and mark the booking ticket_ready.
     * The stored file is removed again if the transition is refused.
     *
     * @return string the public ticket URL
     * @throws BookingTransitionRefused
     */
    public function attachTicket(Booking $booking, UploadedFile $ticket, User $user): string
    {
        if (!$booking->canTransitionTo('ticket_ready')) {
            throw new BookingTransitionRefused("Cannot upload a ticket for a {$booking->status} booking.");
        }

        $path = $ticket->store('tickets', 'public');
        $url = Storage::url($path);

        try {
            $this->transition($booking, 'ticket_ready', $user, ['ticket_photo_url' => $url]);
        } catch (BookingTransitionRefused $e) {
            Storage::disk('public')->delete($path);
            throw $e;
        }

        return $url;
    }

    /**
     * Move the booking to $status (atomic, conditional on its current status)
     * and log it. The message is the admin queue's wording; the legacy
     * endpoints reword from $current/$to.
     *
     * @throws BookingTransitionRefused
     */
    public function transition(Booking $booking, string $status, User $user, array $extra = []): Booking
    {
        $from = $booking->status;
        if (!$booking->transitionTo($status, $user, $extra)) {
            $current = $booking->fresh()->status;
            $message = $current !== $from
                ? 'This booking was just updated by someone else.'
                : "Cannot change a {$from} booking to {$status}.";
            throw new BookingTransitionRefused($message, $from, $current, $status);
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

        return $booking;
    }
}
