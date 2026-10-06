<?php

namespace App\Modules\SharedJourneys\Application;

use RuntimeException;

/** The listing `date` could not be parsed; nothing was written. */
final class InvalidListingDate extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Invalid date.');
    }
}
