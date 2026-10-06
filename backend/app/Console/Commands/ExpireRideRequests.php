<?php

namespace App\Console\Commands;

use App\Modules\NearbyRides\Application\RideService;
use Illuminate\Console\Command;

/** Requests the driver didn't answer within request_timeout_sec become "expired". */
class ExpireRideRequests extends Command
{
    protected $signature = 'rides:expire-requests';
    protected $description = 'Expire ride requests that drivers did not answer in time';

    public function handle(RideService $rides): int
    {
        $count = $rides->expireOverdue();
        $this->info("$count request(s) expired");

        return self::SUCCESS;
    }
}
