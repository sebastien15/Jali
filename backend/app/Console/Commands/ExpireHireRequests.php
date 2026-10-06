<?php

namespace App\Console\Commands;

use App\Modules\DriverHire\Application\HireService;
use Illuminate\Console\Command;

/** Hire requests the driver didn't answer in time become "expired" (story S6.4). */
class ExpireHireRequests extends Command
{
    protected $signature = 'hires:expire-requests';
    protected $description = 'Expire hire-a-driver requests that drivers did not answer in time';

    public function handle(HireService $hires): int
    {
        $count = $hires->expireOverdue();
        $this->info("$count hire request(s) expired");

        return self::SUCCESS;
    }
}
