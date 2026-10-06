<?php

namespace Tests\Feature\Payments;

use App\Models\PlatformSetting;
use App\Modules\Pricing\Application\RideSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** S7.4: fees saved before the zero-fee policy are reset; other settings are kept. */
class ZeroFeesMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_saved_fees_are_zeroed_and_other_settings_kept(): void
    {
        PlatformSetting::updateOrCreate(['key' => RideSettings::KEY], ['value' => [
            'commission_pct' => 12, 'service_fee' => ['type' => 'percent', 'amount' => 5], 'cancel_fee' => 700,
            'hire' => ['commission_pct' => 15, 'service_fee' => 800, 'max_days' => 7],
        ]]);

        (require database_path('migrations/2026_10_08_000001_zero_jali_fees.php'))->up();

        $s = RideSettings::get();
        $this->assertSame(0, $s['commission_pct']);
        $this->assertSame(0, $s['service_fee']['amount']);
        $this->assertSame(0, $s['hire']['commission_pct']);
        $this->assertSame(0, $s['hire']['service_fee']);
        $this->assertSame(700, $s['cancel_fee']);
        $this->assertSame(7, $s['hire']['max_days']);
    }
}
