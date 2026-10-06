<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
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

        // Module contracts (architecture migration M02) -> their single implementation
        $this->app->bind(\App\Modules\Pricing\Contracts\PricingPolicy::class, \App\Modules\Pricing\Application\RideSettings::class);
        $this->app->bind(\App\Modules\Payments\Contracts\MoneyRecorder::class, \App\Modules\Payments\Application\DriverLedger::class);
        $this->app->bind(\App\Modules\Payments\Contracts\ProviderDebtLimit::class, \App\Modules\Payments\Application\DriverLedger::class);
        $this->app->bind(\App\Modules\Providers\Contracts\ProviderReputation::class, \App\Modules\Providers\Application\DriverRating::class);
        $this->app->bind(\App\Modules\Providers\Contracts\ProviderDisplay::class, \App\Modules\Providers\Application\DisplayName::class);
        $this->app->bind(\App\Modules\Payments\Contracts\ReceiptMailer::class, \App\Modules\Payments\Application\Receipts::class);
        $this->app->bind(\App\Modules\Notifications\Contracts\SmsSender::class, \App\Modules\Notifications\Infrastructure\SmsService::class);
        // Push goes through Notifications; the adapter resolves the lazily bound PushService above on every send
        $this->app->bind(\App\Modules\Notifications\Contracts\PushSender::class, \App\Modules\Notifications\Infrastructure\PushServiceSender::class);
        $this->app->bind(\App\Modules\Notifications\Contracts\PushTokens::class, \App\Modules\Notifications\Application\PushTokenRegistry::class);
        $this->app->bind(\App\Modules\Locations\Contracts\Geography::class, \App\Modules\Locations\Application\Geography::class);
        $this->app->bind(\App\Modules\Providers\Contracts\ProviderEligibility::class, \App\Modules\Providers\Application\DriverEligibility::class);
        // Ride rates are owned by NearbyRides; Pricing asks it to re-check them after a guardrail change
        $this->app->bind(\App\Modules\Pricing\Contracts\ProviderRateRevalidator::class, \App\Modules\NearbyRides\Application\RateGuardrails::class);
        // The bus network (Bus) enriches Locations' admin pickup-location list
        $this->app->bind(\App\Modules\Locations\Contracts\TerminalNetwork::class, \App\Modules\Bus\Infrastructure\TerminalNetworkDirectory::class);

        // Generic /bookings: one dispatcher, one handler per booking type. Owning services
        // register their own handler here as they move into their module (runbook M03).
        $this->app->tag([
            \App\Modules\Bus\Infrastructure\BusBookingHandler::class,
            \App\Modules\SharedJourneys\Infrastructure\PrivateSeatBookingHandler::class,
            \App\Modules\Rentals\Infrastructure\RentalBookingHandler::class,
            \App\Modules\Bus\Infrastructure\TripDepartureBookingHandler::class,
        ], \App\Modules\LegacyBookings\Contracts\BookingTypeHandler::class);
        $this->app->when(\App\Modules\LegacyBookings\Application\BookingDispatcher::class)
            ->needs('$handlers')
            ->giveTagged(\App\Modules\LegacyBookings\Contracts\BookingTypeHandler::class);

        // Staff (station agent) earnings shown on the admin profile come from Payments
        $this->app->bind(\App\Modules\Payments\Contracts\StaffEarnings::class, \App\Modules\Payments\Application\StaffCashouts::class);

        // Account deletion (Identity): each owning service closes its part, in this order,
        // inside Identity's transaction (station unassigned, listings and cars off, driver profile removed).
        $this->app->tag([
            \App\Modules\Bus\Infrastructure\StationAgentAccountClosure::class,
            \App\Modules\SharedJourneys\Infrastructure\ListingAccountClosure::class,
            \App\Modules\Rentals\Infrastructure\RentalCarAccountClosure::class,
            \App\Modules\Providers\Infrastructure\DriverProfileAccountClosure::class,
        ], \App\Modules\Identity\Contracts\AccountClosure::class);
        $this->app->when(\App\Modules\Identity\Application\AccountDeletion::class)
            ->needs('$closures')
            ->giveTagged(\App\Modules\Identity\Contracts\AccountClosure::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimits();
    }

    /**
     * Rate limits (story S21.7). Over the limit → 429 JSON with Retry-After.
     * Named limiters are used as `throttle:<name>` in routes/api.php.
     */
    protected function configureRateLimits(): void
    {
        $tooMany = fn (string $message) => fn (Request $request, array $headers) =>
            response()->json(['message' => $message], 429, $headers);

        // Every API route: per signed-in user, else per IP
        RateLimiter::for('api', fn (Request $request) =>
            Limit::perMinute(120)->by($request->user()?->id ? 'u'.$request->user()->id : 'ip'.$request->ip()));

        // Password / Google sign-in: slows down password guessing
        RateLimiter::for('auth', function (Request $request) use ($tooMany) {
            $limits = [Limit::perMinute(10)->by('ip'.$request->ip())->response($tooMany('Too many sign-in attempts. Try again in a minute.'))];
            if ($email = strtolower(trim((string) $request->input('email')))) {
                $limits[] = Limit::perHour(20)->by('login'.$email)->response($tooMany('Too many sign-in attempts. Try again later.'));
            }

            return $limits;
        });

        // SMS codes cost money and can be used to spam a number: 5 per hour per phone
        RateLimiter::for('otp', fn (Request $request) => array_filter([
            Limit::perHour(30)->by('otpip'.$request->ip())->response($tooMany('Too many codes requested. Try again later.')),
            $this->phoneKey($request) === '' ? null
                : Limit::perHour(5)->by('otp'.$this->phoneKey($request))->response($tooMany('Too many codes requested for this number. Try again in an hour.')),
        ]));

        // Code guessing: 10 tries per hour per phone
        RateLimiter::for('otp-verify', fn (Request $request) => array_filter([
            Limit::perMinute(20)->by('otpvip'.$request->ip())->response($tooMany('Too many attempts. Try again in a minute.')),
            $this->phoneKey($request) === '' ? null
                : Limit::perHour(10)->by('otpv'.$this->phoneKey($request))->response($tooMany('Too many wrong codes. Request a new code later.')),
        ]));

        // Ride requests notify a driver each time: stop request spam
        RateLimiter::for('ride-requests', fn (Request $request) =>
            Limit::perMinute(6)->by('ride'.($request->user()?->id ?? $request->ip()))
                ->response($tooMany('Too many ride requests. Wait a moment and try again.')));
    }

    /** Same number however it was typed: +250 788…, 0788…, 250788… */
    private function phoneKey(Request $request): string
    {
        $digits = preg_replace('/\D/', '', (string) $request->input('phone'));

        return substr($digits, -9);
    }
}
