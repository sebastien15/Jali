<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Neon (free tier) can take up to 10–15 s to wake from pause;
        // raise the limit so the first request after idle doesn't 500.
        ini_set('max_execution_time', '120');
    }
}
