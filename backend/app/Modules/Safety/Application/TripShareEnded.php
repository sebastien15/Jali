<?php

namespace App\Modules\Safety\Application;

use RuntimeException;

/** A public share link whose ride is over; the transport answers 410 with the ride status. */
final class TripShareEnded extends RuntimeException
{
    public function __construct(public readonly string $status)
    {
        parent::__construct('This trip has ended.');
    }
}
