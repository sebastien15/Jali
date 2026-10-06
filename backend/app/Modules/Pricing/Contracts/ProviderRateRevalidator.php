<?php

namespace App\Modules\Pricing\Contracts;

/**
 * Called by Pricing right after the superadmin saves platform_settings['rides'],
 * so the service that owns provider-set rates can re-check them against the new
 * limits (implemented by NearbyRides for ride rates). Pricing never touches
 * driver_rates itself.
 */
interface ProviderRateRevalidator
{
    /** Flag/clear out-of-limit rates and notify newly flagged providers; returns how many were newly flagged. */
    public function revalidateProviderRates(): int;
}
