<?php

namespace App\Modules\LegacyBookings\Application;

use RuntimeException;

/** A booking the business rules refuse; the transport maps it to {error, message} with $status. */
class BookingRejected extends RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $error, string $message)
    {
        parent::__construct($message);
    }
}
