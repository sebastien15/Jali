<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// On-demand rides housekeeping (needs `php artisan schedule:run` every minute via cron)
\Illuminate\Support\Facades\Schedule::command('rides:expire-presence')->everyMinute()->withoutOverlapping();
