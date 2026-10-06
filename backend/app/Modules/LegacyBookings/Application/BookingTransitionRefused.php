<?php

namespace App\Modules\LegacyBookings\Application;

use RuntimeException;

/**
 * An admin booking change the lifecycle refuses; nothing was written. The
 * transport maps it to 422. $from/$current/$to let each endpoint keep its own
 * historical wording (see AdminBookingQueue).
 */
final class BookingTransitionRefused extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly ?string $from = null,
        public readonly ?string $current = null,
        public readonly ?string $to = null,
    ) {
        parent::__construct($message);
    }
}
