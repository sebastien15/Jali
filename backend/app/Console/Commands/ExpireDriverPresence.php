<?php

namespace App\Console\Commands;

use App\Modules\NearbyRides\Application\DriverPresenceSwitch;
use Illuminate\Console\Command;

/**
 * Marks drivers offline when their app stopped sending heartbeats.
 * Nearby search already ignores stale rows; this keeps the table honest
 * for dashboards and the next "online since" value.
 */
class ExpireDriverPresence extends Command
{
    protected $signature = 'rides:expire-presence';
    protected $description = 'Set drivers offline after presence_ttl_sec without a heartbeat';

    public function handle(DriverPresenceSwitch $presence): int
    {
        $count = $presence->expireStale();

        $this->info("$count driver(s) set offline");

        return self::SUCCESS;
    }
}
