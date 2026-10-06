<?php

namespace App\Modules\NearbyRides\Application;

use RuntimeException;

/** Only completed rides can have their fare/commission adjusted; nothing was written. */
final class RideNotAdjustable extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Only completed rides can be adjusted.');
    }
}
