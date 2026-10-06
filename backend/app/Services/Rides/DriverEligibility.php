<?php

namespace App\Services\Rides;

use App\Models\DriverProfile;
use App\Models\DriverRate;
use App\Models\User;
use App\Models\Vehicle;

/**
 * Can this driver go online for on-demand rides right now? (story S5.1)
 * Returns machine-readable reasons the app turns into "what's missing".
 */
class DriverEligibility
{
    public const NOT_VERIFIED = 'not_verified';
    public const SUSPENDED = 'suspended';
    public const NO_VEHICLE = 'no_active_vehicle';
    public const INSURANCE_EXPIRED = 'insurance_expired';
    public const NO_FRONT_PHOTO = 'no_vehicle_photo';
    public const NO_RATES = 'no_rates';
    public const RATES_OUT_OF_BAND = 'rates_outside_limits';
    public const COMMISSION_OWED = 'commission_owed';

    /** @return string[] empty when the driver may go online */
    public static function blockers(User $user): array
    {
        // Always reload: the same User instance may be reused across checks
        $user->load('driverProfile', 'vehicles');
        $profile = $user->driverProfile;
        $reasons = [];

        if ($profile?->verification_status === DriverProfile::STATUS_SUSPENDED) {
            return [self::SUSPENDED];
        }
        if (!$profile?->isVerified()) {
            $reasons[] = self::NOT_VERIFIED;
        }
        if (\App\Services\Payments\DriverLedger::overLimit($user->id)) {
            $reasons[] = self::COMMISSION_OWED;   // S5.4: settle before going online
        }

        /** @var Vehicle|null $vehicle */
        $vehicle = $user->vehicles->firstWhere('is_active', true);
        if (!$vehicle) {
            $reasons[] = self::NO_VEHICLE;
            $reasons[] = self::NO_RATES;

            return $reasons;
        }
        if (!$vehicle->hasValidInsurance()) {
            $reasons[] = self::INSURANCE_EXPIRED;
        }
        if (empty(((array) $vehicle->photos)['front'] ?? null)) {
            $reasons[] = self::NO_FRONT_PHOTO;
        }

        $rate = DriverRate::where(['user_id' => $user->id, 'vehicle_id' => $vehicle->id, 'service' => 'ride', 'is_active' => true])->first();
        if (!$rate) {
            $reasons[] = self::NO_RATES;
        } elseif ($rate->out_of_band_at) {
            $reasons[] = self::RATES_OUT_OF_BAND;
        }

        return $reasons;
    }
}
