<?php

namespace App\Modules\Providers\Application;

use App\Models\DriverDocument;
use App\Models\DriverProfile;
use App\Models\DriverRate;
use App\Models\User;

/**
 * Driver application checklist (stories S1.1, S1.2): what a rider must
 * complete before an admin can verify them as a driver.
 */
class DriverOnboarding
{
    /** Services that need a vehicle (hire-a-driver drives the customer's car). */
    public const VEHICLE_SERVICES = ['ride', 'private_seat', 'rental'];

    public static function requiredDocuments(array $services): array
    {
        $docs = ['licence_front', 'licence_back', 'national_id', 'selfie'];
        if (array_intersect($services, self::VEHICLE_SERVICES)) {
            $docs[] = 'insurance';
        }

        return $docs;
    }

    /** @return array{status: string, can_submit: bool, steps: array<int, array{key: string, done: bool, required: bool}>} */
    public static function checklist(User $user): array
    {
        $user->loadMissing('driverProfile', 'vehicles', 'driverDocuments');
        $profile = $user->driverProfile;
        $services = $profile->services ?? [];
        $needsVehicle = (bool) array_intersect($services, self::VEHICLE_SERVICES);
        $vehicle = $user->vehicles->firstWhere('is_active', true);
        $docs = $user->driverDocuments->keyBy('type');

        $docsDone = collect(self::requiredDocuments($services))
            ->every(fn ($type) => isset($docs[$type]) && $docs[$type]->status !== DriverDocument::STATUS_REJECTED);

        $licenceDone = $profile && $profile->licence_no && $profile->licence_expiry
            && $profile->licence_expiry->endOfDay()->isFuture() && !empty($profile->licence_categories);

        $vehicleDone = $vehicle && !empty(((array) $vehicle->photos)['front'] ?? null) && $vehicle->hasValidInsurance();

        $ratesDone = $vehicle && DriverRate::where([
            'user_id' => $user->id, 'vehicle_id' => $vehicle->id, 'service' => 'ride',
        ])->exists();

        $steps = [
            ['key' => 'services',  'done' => !empty($services),                  'required' => true],
            ['key' => 'profile',   'done' => (bool) ($user->name && $user->phone), 'required' => true],
            ['key' => 'licence',   'done' => (bool) $licenceDone,                'required' => true],
            ['key' => 'documents', 'done' => $docsDone,                          'required' => true],
            ['key' => 'vehicle',   'done' => (bool) $vehicleDone,                'required' => $needsVehicle],
            ['key' => 'rates',     'done' => (bool) $ratesDone,                  'required' => in_array('ride', $services, true)],
        ];

        $canSubmit = collect($steps)->every(fn ($s) => $s['done'] || !$s['required']);

        return [
            'status'     => self::status($profile),
            'can_submit' => $canSubmit,
            'steps'      => $steps,
        ];
    }

    /** draft | pending | verified | rejected | suspended */
    public static function status(?DriverProfile $profile): string
    {
        if (!$profile) {
            return 'draft';
        }
        if ($profile->verification_status === DriverProfile::STATUS_PENDING && !$profile->submitted_at) {
            return 'draft';
        }

        return $profile->verification_status;
    }
}
