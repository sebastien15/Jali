<?php

namespace App\Modules\LegacyBookings\Contracts;

/** What the customer asked for; prices, titles and locations are never taken from here. */
final class BookingRequest
{
    public function __construct(
        public readonly string $type,
        public readonly int $referenceId,
        public readonly ?int $quantity,
        public readonly ?int $days,
        public readonly ?int $clientServiceFee,
        public readonly ?string $travelDate,
    ) {
    }
}
