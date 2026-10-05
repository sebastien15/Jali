<?php

namespace App\Console\Commands;

use App\Models\DriverPresence;
use App\Services\Rides\RideSettings;
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

    public function handle(): int
    {
        $ttl = (int) RideSettings::get()['presence_ttl_sec'];
        $count = DriverPresence::where('is_online', true)
            ->where(fn ($q) => $q->whereNull('last_seen_at')->orWhere('last_seen_at', '<', now()->subSeconds($ttl)))
            ->update(['is_online' => false, 'online_since' => null]);

        $this->info("$count driver(s) set offline");

        return self::SUCCESS;
    }
}
