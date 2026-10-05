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
        // Build the Firebase messaging client lazily inside PushService (never at resolve time),
        // so a missing credentials file can't turn a push into a failed request.
        $this->app->bind(\App\Services\PushService::class, fn () => new \App\Services\PushService());
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
