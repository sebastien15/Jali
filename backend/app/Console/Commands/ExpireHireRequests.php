<?php

namespace App\Console\Commands;

use App\Models\DriverHire;
use App\Services\Hire\HireService;
use Illuminate\Console\Command;

/** Hire requests the driver didn't answer in time become "expired" (story S6.4). */
class ExpireHireRequests extends Command
{
    protected $signature = 'hires:expire-requests';
    protected $description = 'Expire hire-a-driver requests that drivers did not answer in time';

    public function handle(HireService $hires): int
    {
        $count = 0;
        DriverHire::where('status', DriverHire::REQUESTED)->where('expires_at', '<', now())->each(function (DriverHire $hire) use ($hires, &$count) {
            $count += (int) $hires->expire($hire);
        });
        $this->info("$count hire request(s) expired");

        return self::SUCCESS;
    }
}
