<?php

namespace App\Services\Rides;

use App\Models\PlatformSetting;
use App\Models\User;

/**
 * Ride pricing guardrails and dispatch settings (RIDE_HAILING_PLAN.md §3.3).
 * Stored in platform_settings under the `rides` key; defaults apply until the
 * superadmin saves something, so the system works before configuration.
 *
 * Default values are placeholders — check RURA regulations before production.
 */
class RideSettings
{
    public const KEY = 'rides';

    public static function defaults(): array
    {
        return [
            'vehicle_classes' => [
                'moto'    => ['per_km_min' => 150, 'per_km_max' => 600,  'min_fare_max' => 1500],
                'car'     => ['per_km_min' => 300, 'per_km_max' => 1200, 'min_fare_max' => 5000],
                'comfort' => ['per_km_min' => 500, 'per_km_max' => 2000, 'min_fare_max' => 8000],
                'van'     => ['per_km_min' => 400, 'per_km_max' => 2000, 'min_fare_max' => 10000],
            ],
            'road_factor'         => 1.3,
            'commission_pct'      => 8,
            'service_fee'         => ['type' => 'flat', 'amount' => 200],
            'nearby_radius_km'    => 5,
            'presence_ttl_sec'    => 60,
            'request_timeout_sec' => 30,
        ];
    }

    public static function get(): array
    {
        $saved = PlatformSetting::where('key', self::KEY)->value('value');

        return array_replace_recursive(self::defaults(), is_array($saved) ? $saved : []);
    }

    /** Guardrails for one vehicle class (falls back to `car`). */
    public static function forClass(string $class): array
    {
        $classes = self::get()['vehicle_classes'];

        return $classes[$class] ?? $classes['car'];
    }

    /** @return array{0: array, 1: array} [old, new] */
    public static function update(array $values, User $by): array
    {
        $old = self::get();
        $new = array_replace_recursive($old, $values);

        PlatformSetting::updateOrCreate(
            ['key' => self::KEY],
            ['value' => $new, 'updated_by' => $by->id],
        );

        return [$old, $new];
    }

    /** Laravel validation rules for a full or partial settings payload. */
    public static function rules(): array
    {
        $rules = [
            'vehicle_classes'     => 'sometimes|array',
            'road_factor'         => 'sometimes|numeric|min:1|max:3',
            'commission_pct'      => 'sometimes|numeric|min:0|max:50',
            'service_fee'         => 'sometimes|array',
            'service_fee.type'    => 'required_with:service_fee|in:flat,percent',
            'service_fee.amount'  => 'required_with:service_fee|numeric|min:0',
            'nearby_radius_km'    => 'sometimes|numeric|min:0.5|max:50',
            'presence_ttl_sec'    => 'sometimes|integer|min:15|max:600',
            'request_timeout_sec' => 'sometimes|integer|min:10|max:300',
        ];
        foreach (array_keys(self::defaults()['vehicle_classes']) as $class) {
            $rules["vehicle_classes.$class"] = 'sometimes|array';
            $rules["vehicle_classes.$class.per_km_min"] = "required_with:vehicle_classes.$class|integer|min:0";
            $rules["vehicle_classes.$class.per_km_max"] = "required_with:vehicle_classes.$class|integer|gte:vehicle_classes.$class.per_km_min";
            $rules["vehicle_classes.$class.min_fare_max"] = "required_with:vehicle_classes.$class|integer|min:0";
        }

        return $rules;
    }
}
