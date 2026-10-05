<?php

namespace App\Console\Commands;

use App\Models\Ride;
use App\Services\Rides\RideService;
use Illuminate\Console\Command;

/** Requests the driver didn't answer within request_timeout_sec become "expired". */
class ExpireRideRequests extends Command
{
    protected $signature = 'rides:expire-requests';
    protected $description = 'Expire ride requests that drivers did not answer in time';

    public function handle(RideService $rides): int
    {
        $count = 0;
        Ride::where('status', Ride::REQUESTED)->where('expires_at', '<', now())->each(function (Ride $ride) use ($rides, &$count) {
            $count += (int) $rides->expire($ride);
        });
        $this->info("$count request(s) expired");

        return self::SUCCESS;
    }
}
