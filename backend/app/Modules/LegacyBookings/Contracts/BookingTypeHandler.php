<?php

namespace App\Modules\LegacyBookings\Contracts;

/**
 * Per-type rules for a generic `bookings` row (type bus/private/rental/trip).
 * The owning service supplies one handler; LegacyBookings coordinates capacity,
 * persistence and audit. `reference_id` keeps its existing meaning per type.
 */
interface BookingTypeHandler
{
    /** The `bookings.type` value this handler owns. */
    public function type(): string;

    /**
     * Lock the referenced item for update and price it server-side.
     * Must run inside the dispatcher's transaction.
     *
     * @return BookableOffer|null null when the item is missing or not bookable
     */
    public function offer(BookingRequest $request): ?BookableOffer;
}
