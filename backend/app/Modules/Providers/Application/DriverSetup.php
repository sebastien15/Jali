<?php

namespace App\Modules\Providers\Application;

use App\Models\DriverProfile;
use App\Models\User;
use App\Models\Vehicle;
use App\Modules\Notifications\Contracts\PushTokens;
use Illuminate\Support\Facades\DB;

/**
 * GET/PATCH /driver/profile — what driver/setup.tsx collects: display name,
 * push token, offered services, operating zones, documents link and the
 * active vehicle (created on first save). Input is validated by the transport.
 */
class DriverSetup
{
    /** Setup screen field => vehicles column */
    private const VEHICLE_FIELDS = [
        'car_model'        => 'model',
        'plate'            => 'plate',
        'car_type'         => 'body_type',
        'seats'            => 'seats',
        'amenities'        => 'amenities',
        'insurance_expiry' => 'insurance_expiry',
        'price_day'        => 'rental_price_day',
        'caution'          => 'rental_caution',
    ];

    public function __construct(private readonly PushTokens $pushTokens)
    {
    }

    /** The vehicle the setup screen edits (null until the first save creates one). */
    public function activeVehicle(User $user): ?Vehicle
    {
        return $user->vehicles()->where('is_active', true)->first();
    }

    public function save(User $user, ?Vehicle $vehicle, array $validated): array
    {
        DB::transaction(function () use ($user, $vehicle, $validated) {
            $user->update(array_intersect_key($validated, array_flip(['name'])));
            if (array_key_exists('fcm_token', $validated)) {
                $this->pushTokens->register($user, $validated['fcm_token']);
            }

            $profileData = array_intersect_key($validated, array_flip(['services', 'allowed_zones', 'docs_url']));
            $profile = $user->driverProfile()->firstOrCreate([]);
            if ($profileData) {
                $profile->update($profileData);
            }

            $vehicleData = $this->vehicleAttributes($validated);
            if ($vehicle && $vehicleData) {
                $vehicle->update($vehicleData);
            } elseif (!$vehicle && isset($vehicleData['model'], $vehicleData['plate'])) {
                $user->vehicles()->create($vehicleData + ['is_active' => true]);
            }
        });

        return $this->payload($user->fresh());
    }

    public function payload(User $user): array
    {
        $user->loadMissing('driverProfile', 'vehicles');
        $profile = $user->driverProfile;

        return [
            'user' => [
                'id'    => $user->id,
                'name'  => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
            ],
            'profile' => $profile ? [
                'services'            => $profile->services ?? [],
                'allowed_zones'       => $profile->allowed_zones ?? [],
                'docs_url'            => $profile->docs_url,
                'verification_status' => $profile->verification_status ?? DriverProfile::STATUS_PENDING,
                'rating_avg'          => $profile->rating_avg,
                'trips_count'         => $profile->trips_count,
            ] : null,
            'vehicle'  => $user->vehicles->firstWhere('is_active', true),
            'vehicles' => $user->vehicles->values(),
        ];
    }

    /** Maps the setup screen's field names onto vehicle columns. */
    private function vehicleAttributes(array $validated): array
    {
        $attributes = [];
        foreach (self::VEHICLE_FIELDS as $input => $column) {
            if (array_key_exists($input, $validated)) {
                $attributes[$column] = $validated[$input];
            }
        }
        if (isset($attributes['body_type'])) {
            $attributes['class'] = $attributes['body_type'] === 'Minivan' ? 'van' : 'car';
        }

        return $attributes;
    }
}
