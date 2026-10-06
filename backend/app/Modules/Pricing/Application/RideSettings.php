<?php

namespace App\Modules\Pricing\Application;

use App\Models\PlatformSetting;
use App\Models\User;
use App\Modules\Pricing\Contracts\PricingPolicy;

/**
 * Ride pricing guardrails and dispatch settings (RIDE_HAILING_PLAN.md §3.3).
 * Stored in platform_settings under the `rides` key; defaults apply until the
 * superadmin saves something, so the system works before configuration.
 *
 * Default values are placeholders — check RURA regulations before production.
 */
class RideSettings implements PricingPolicy
{
    public const KEY = 'rides';

    public function settings(): array
    {
        return self::get();
    }

    public function hireSettings(): array
    {
        return self::hire();
    }

    public function vehicleClassLimits(string $class): array
    {
        return self::forClass($class);
    }

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
            'cancel_fee'          => 500,   // charged when the rider cancels after the free waiting time
            'free_wait_min'       => 5,
            'broadcast_max_drivers' => 5,   // S3.5: how many nearest drivers get a broadcast request
            // S7.2 / S5.4: drivers who owe more than this can't go online until they settle
            'max_commission_owed' => 20000,
            'settlement_momo'     => ['number' => '', 'name' => 'Jali'],   // where drivers send commission
            // S8.4: who appears in the admin "Needs review" list
            'review' => ['min_rated_trips' => 20, 'min_rating' => 4.0, 'max_cancel_pct' => 15, 'min_accepted' => 10, 'days' => 30],
            // Hire a Driver (epic E6) — limits on driver-set prices and booking rules
            'hire' => [
                'hourly_min'          => 1000,
                'hourly_max'          => 15000,
                'daily_min'           => 10000,
                'daily_max'           => 150000,
                'overtime_max'        => 20000,
                'out_of_town_max'     => 50000,
                'commission_pct'      => 10,
                'service_fee'         => 500,
                'request_timeout_min' => 60,   // driver must answer within this, or before the start
                'free_cancel_hours'   => 3,    // customer cancels free until this long before the start
                'late_cancel_pct'     => 20,   // of the driver's price, paid to the driver when later
                'overtime_grace_min'  => 15,
                'max_days'            => 14,
            ],
        ];
    }

    public static function get(): array
    {
        $saved = PlatformSetting::where('key', self::KEY)->value('value');

        return array_replace_recursive(self::defaults(), is_array($saved) ? $saved : []);
    }

    /** Hire-a-driver settings (epic E6) */
    public static function hire(): array
    {
        return self::get()['hire'];
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
            'cancel_fee'          => 'sometimes|integer|min:0|max:10000',
            'free_wait_min'       => 'sometimes|integer|min:0|max:30',
            'broadcast_max_drivers' => 'sometimes|integer|min:1|max:20',
            'max_commission_owed'   => 'sometimes|integer|min:0|max:1000000',
            'settlement_momo'        => 'sometimes|array',
            'settlement_momo.number' => 'sometimes|nullable|string|max:20',
            'settlement_momo.name'   => 'sometimes|nullable|string|max:100',
            'review'                 => 'sometimes|array',
            'review.min_rated_trips' => 'sometimes|integer|min:1|max:1000',
            'review.min_rating'      => 'sometimes|numeric|min:1|max:5',
            'review.max_cancel_pct'  => 'sometimes|numeric|min:0|max:100',
            'review.min_accepted'    => 'sometimes|integer|min:1|max:1000',
            'review.days'            => 'sometimes|integer|min:1|max:365',
            'hire'                        => 'sometimes|array',
            'hire.hourly_min'             => 'sometimes|integer|min:0',
            'hire.hourly_max'             => 'sometimes|integer|min:0',
            'hire.daily_min'              => 'sometimes|integer|min:0',
            'hire.daily_max'              => 'sometimes|integer|min:0',
            'hire.overtime_max'           => 'sometimes|integer|min:0',
            'hire.out_of_town_max'        => 'sometimes|integer|min:0',
            'hire.commission_pct'         => 'sometimes|numeric|min:0|max:50',
            'hire.service_fee'            => 'sometimes|integer|min:0|max:10000',
            'hire.request_timeout_min'    => 'sometimes|integer|min:5|max:1440',
            'hire.free_cancel_hours'      => 'sometimes|integer|min:0|max:72',
            'hire.late_cancel_pct'        => 'sometimes|integer|min:0|max:100',
            'hire.overtime_grace_min'     => 'sometimes|integer|min:0|max:60',
            'hire.max_days'               => 'sometimes|integer|min:1|max:60',
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
