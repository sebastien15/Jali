<?php

namespace Tests\Support;

use App\Models\PlatformSetting;
use App\Modules\Pricing\Application\RideSettings;

/**
 * Jali charges no fees by default (S7.4), but a superadmin can still set a
 * commission and service fee. Tests that cover that money path call this.
 */
trait WithConfiguredFees
{
    protected function configureFees(): void
    {
        PlatformSetting::updateOrCreate(['key' => RideSettings::KEY], ['value' => [
            'commission_pct' => 8,
            'service_fee'    => ['type' => 'flat', 'amount' => 200],
            'hire'           => ['commission_pct' => 10, 'service_fee' => 500],
        ]]);
    }
}
