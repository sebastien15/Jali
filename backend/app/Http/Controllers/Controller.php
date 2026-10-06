<?php

namespace App\Http\Controllers;

use App\Models\AdminStation;
use App\Models\Booking;
use App\Models\User;

abstract class Controller
{
    /**
     * Booking statuses that still need a seat / admin action.
     */
    protected const ACTIVE_BOOKING_STATUSES = ['pending', 'taken', 'ticket_ready'];

    protected function abortUnlessSuperAdmin(User $user): void
    {
        abort_unless($user->isSuperAdmin(), 403, 'Only a superadmin can do this.');
    }

    /**
     * Station admins may only change routes that depart from a station
     * assigned to them; superadmins may change any route.
     */
    protected function abortUnlessManagesStation(User $user, int $stationId): void
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

    protected function hasActiveBookings(iterable $departureIds): bool
    {
        return Booking::whereIn('trip_departure_id', collect($departureIds))
            ->whereIn('status', self::ACTIVE_BOOKING_STATUSES)
            ->exists();
    }
}
