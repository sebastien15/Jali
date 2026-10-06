<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// On-demand rides housekeeping (needs `php artisan schedule:run` every minute via cron)
\Illuminate\Support\Facades\Schedule::command('rides:expire-presence')->everyMinute()->withoutOverlapping();
\Illuminate\Support\Facades\Schedule::command('rides:expire-requests')->everyMinute()->withoutOverlapping();
\Illuminate\Support\Facades\Schedule::command('hires:expire-requests')->everyMinute()->withoutOverlapping();
\Illuminate\Support\Facades\Schedule::command('rentals:expire-requests')->everyMinute()->withoutOverlapping();
\Illuminate\Support\Facades\Schedule::call(fn () => app(\App\Modules\Payments\Application\ExchangeRates::class)->refresh())->dailyAt('03:15')->name('fx:refresh');
