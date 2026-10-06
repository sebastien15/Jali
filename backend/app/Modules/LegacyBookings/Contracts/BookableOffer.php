<?php

namespace App\Modules\LegacyBookings\Contracts;

/** A handler's server-side terms for one booking of a locked, bookable item. */
final class BookableOffer
{
    public function __construct(
        /** Seats/units the item offers per travel date */
        public readonly int $capacity,
        /** Units this booking takes (a rental is always 1) */
        public readonly int $quantity,
        /** Total item price, without the service fee */
        public readonly int $price,
        public readonly int $serviceFee,
        public readonly string $title,
        public readonly string $sub,
        /** Departure city used to route the booking to a station, if any */
        public readonly ?string $originCity,
        /** bookings.trip_departure_id (trip type only) */
        public readonly ?int $tripDepartureId = null,
    ) {
    }
}
