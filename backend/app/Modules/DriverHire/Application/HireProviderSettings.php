<?php

namespace App\Modules\DriverHire\Application;

use App\Models\DriverProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * A driver's hire prices and skills (story S6.1). Prices are checked against
 * the superadmin limits by HireQuote::rateRules(); skills live on the driver
 * profile. Input arrays are already validated by the transport adapter.
 */
class HireProviderSettings
{
    public const LANGUAGES = ['rw', 'en', 'fr', 'sw', 'other'];

    private const RATE_FIELDS = ['hourly_rate', 'min_hours', 'daily_rate', 'daily_hours', 'overtime_per_hour', 'out_of_town_fee', 'is_active'];
    private const SKILL_FIELDS = ['transmissions', 'languages', 'years_experience'];

    /** The user as a hire provider: offer-driver-hire permission and a verified profile, else 403 */
    public function provider(User $user): User
    {
        abort_unless($user->hasPermission('offer-driver-hire'), 403, 'You do not have permission to offer driver hire.');
        $user->load('driverProfile', 'hireSettings');
        abort_unless($user->driverProfile?->verification_status === DriverProfile::STATUS_VERIFIED, 403, 'Your driver account must be verified first.');

        return $user;
    }

    public function update(User $driver, array $validated): User
    {
        DB::transaction(function () use ($driver, $validated) {
            $driver->hireSettings()->updateOrCreate(['user_id' => $driver->id], array_intersect_key($validated, array_flip(self::RATE_FIELDS)));
            $driver->driverProfile->update(array_intersect_key($validated, array_flip(self::SKILL_FIELDS)));
        });

        return $driver->fresh();
    }

    /** GET/PUT /driver/hire-settings response */
    public function payload(User $driver): array
    {
        $profile = $driver->driverProfile;
        $g = HireQuote::settings();

        return [
            'settings' => $driver->hireSettings ? array_intersect_key($driver->hireSettings->toArray(), array_flip(self::RATE_FIELDS)) : null,
            'skills' => [
                'transmissions'      => $profile->transmissions ?? [],
                'languages'          => $profile->languages ?? [],
                'years_experience'   => $profile->years_experience,
                'licence_categories' => $profile->licence_categories ?? [],
            ],
            'limits' => array_intersect_key($g, array_flip(['hourly_min', 'hourly_max', 'daily_min', 'daily_max', 'overtime_max', 'out_of_town_max', 'commission_pct', 'service_fee'])),
        ];
    }
}
