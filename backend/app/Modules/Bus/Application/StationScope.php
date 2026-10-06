<?php

namespace App\Modules\Bus\Application;

use App\Models\AdminStation;
use App\Models\Booking;
use App\Models\User;

/**
 * Who may change bus operations, and whether departures still hold seats.
 * Moved unchanged from the base HTTP Controller (M03-Bus): station admins may
 * only change routes departing from a station assigned to them; superadmins
 * may change any route. Never widen this during refactors (runbook §2).
 */
class StationScope
{
    /** Booking statuses that still need a seat / admin action. */
    public const ACTIVE_BOOKING_STATUSES = ['pending', 'taken', 'ticket_ready'];

    public function abortUnlessSuperAdmin(User $user): void
    {
        abort_unless($user->isSuperAdmin(), 403, 'Only a superadmin can do this.');
    }

    public function abortUnlessManagesStation(User $user, int $stationId): void
    {
        if ($user->isSuperAdmin()) {
            return;
        }
        abort_unless(
            AdminStation::whereKey($stationId)->where('user_id', $user->id)->exists(),
            403,
            'You can only manage routes departing from your assigned station.',
        );
    }

    public function hasActiveBookings(iterable $departureIds): bool
    {
        return Booking::whereIn('trip_departure_id', collect($departureIds))
            ->whereIn('status', self::ACTIVE_BOOKING_STATUSES)
            ->exists();
    }
}
