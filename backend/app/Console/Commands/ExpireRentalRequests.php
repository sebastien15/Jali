<?php

namespace App\Console\Commands;

use App\Modules\Rentals\Application\RentalService;
use Illuminate\Console\Command;

/** Rental requests the owner did not answer in time become expired (story S24.4). */
class ExpireRentalRequests extends Command
{
    protected $signature = 'rentals:expire-requests';

    protected $description = 'Expire rental requests the owner did not answer in time';

    public function handle(RentalService $rentals): int
    {
        $this->info($rentals->expireRequests() . ' rental requests expired.');

        return self::SUCCESS;
    }
}
