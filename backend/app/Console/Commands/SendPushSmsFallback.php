<?php

namespace App\Console\Commands;

use App\Modules\Notifications\Application\PushStats;
use Illuminate\Console\Command;

/** S12.3: text critical pushes (driver arrived) that were not opened in time */
class SendPushSmsFallback extends Command
{
    protected $signature = 'notifications:sms-fallback';
    protected $description = 'Send the SMS fallback for critical push notifications that were not opened in time';

    public function handle(PushStats $stats): int
    {
        $this->info($stats->sendDueSms() . ' SMS sent');

        return self::SUCCESS;
    }
}
