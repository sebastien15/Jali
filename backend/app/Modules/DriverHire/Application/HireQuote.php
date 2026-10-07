<?php

namespace App\Modules\DriverHire\Application;

use App\Modules\Pricing\Contracts\PricingPolicy;
use Carbon\CarbonInterface;

/**
 * Price of a hire from the driver's own rates (story S6.3) and overtime at
 * check-out (story S6.4). Server-side only — the client never sends a price.
 */
class HireQuote
{
    /** S13.7: hour packages when the driver brings their car */
    public const CAR_PACKAGES = [2, 4, 8];

    /**
     * @param array $rate driver rate snapshot (DriverHireSetting::snapshot())
     * @return array{driver_total:int, service_fee:int, total:int, billable_hours:int, days:int, km_allowance:int}
     */
    public static function quote(array $rate, string $durationType, int $value, string $tripType, bool $withCar = false): array
    {
        if ($withCar) {
            // Package with the driver's car: car rate × hours, km allowance per hour (S13.7)
            $driver = (int) $rate['car_hourly_rate'] * $value;
            if ($tripType === 'out_of_town') {
                $driver += (int) ($rate['out_of_town_fee'] ?? 0);
            }
            $driver = self::roundUp($driver);
            $fee = (int) self::settings()['service_fee'];

            return ['driver_total' => $driver, 'service_fee' => $fee, 'total' => $driver + $fee, 'billable_hours' => $value, 'days' => 1,
                'km_allowance' => (int) $rate['km_per_hour'] * $value];
        }
        if ($durationType === 'days') {
            $days = $value;
            $billableHours = $value * (int) $rate['daily_hours'];
            $driver = $rate['daily_rate'] * $value;
        } else {
            $days = 1;
            $billableHours = max($value, (int) $rate['min_hours']);
            $driver = $rate['hourly_rate'] * $billableHours;
        }
        if ($tripType === 'out_of_town') {
            $driver += $rate['out_of_town_fee'] * $days;
        }
        $driver = self::roundUp($driver);
        $fee = (int) self::settings()['service_fee'];

        return ['driver_total' => $driver, 'service_fee' => $fee, 'total' => $driver + $fee, 'billable_hours' => $billableHours, 'days' => $days,
            'km_allowance' => 0];
    }

    /** S13.7: km beyond the allowance, charged at the driver's extra-km rate */
    public static function extraKm(array $rate, int $allowance, int $odometerStart, int $odometerEnd): array
    {
        $km = max(0, ($odometerEnd - $odometerStart) - $allowance);

        return ['km' => $km, 'amount' => $km ? self::roundUp($km * (int) ($rate['extra_km_rate'] ?? 0)) : 0];
    }

    /** When the booked time ends */
    public static function endAt(CarbonInterface $start, string $durationType, int $value, int $dailyHours): CarbonInterface
    {
        return $durationType === 'days'
            ? $start->copy()->addDays($value - 1)->addHours($dailyHours)
            : $start->copy()->addHours($value);
    }

    /**
     * Overtime after the booked time. The booked length counts from check-in when
     * the driver started late because of the customer, so they never lose paid time.
     *
     * @return array{minutes:int, amount:int}
     */
    public static function overtime(array $rate, CarbonInterface $start, CarbonInterface $end, CarbonInterface $checkIn, CarbonInterface $checkOut): array
    {
        $bookedMinutes = $start->diffInMinutes($end);
        $expectedEnd = $end->max($checkIn->copy()->addMinutes($bookedMinutes));
        $minutes = (int) max(0, floor($expectedEnd->diffInMinutes($checkOut, false)));
        if ($minutes <= (int) self::settings()['overtime_grace_min']) {
            return ['minutes' => 0, 'amount' => 0];
        }

        return ['minutes' => $minutes, 'amount' => self::roundUp($minutes / 60 * $rate['overtime_per_hour'])];
    }

    /** Current hire limits and fees from the shared pricing policy */
    public static function settings(): array
    {
        return app(PricingPolicy::class)->hireSettings();
    }

    public static function roundUp(float $amount): int
    {
        return (int) (ceil($amount / 100) * 100);
    }

    /** Validation rules for a driver's hire prices against the superadmin limits (story S6.1) */
    public static function rateRules(): array
    {
        $g = self::settings();

        return [
            'hourly_rate'       => "required|integer|min:{$g['hourly_min']}|max:{$g['hourly_max']}",
            'min_hours'         => 'required|integer|min:1|max:12',
            'daily_rate'        => "required|integer|min:{$g['daily_min']}|max:{$g['daily_max']}",
            'daily_hours'       => 'required|integer|min:4|max:16',
            'overtime_per_hour' => "required|integer|min:0|max:{$g['overtime_max']}",
            'out_of_town_fee'   => "sometimes|integer|min:0|max:{$g['out_of_town_max']}",
            'is_active'         => 'sometimes|boolean',
            // S13.7: with the driver's own car
            'offers_car'        => 'sometimes|boolean',
            'car_vehicle_id'    => 'nullable|required_if_accepted:offers_car|integer',
            'car_hourly_rate'   => "nullable|required_if_accepted:offers_car|integer|min:{$g['hourly_min']}|max:{$g['car_hourly_max']}",
            'km_per_hour'       => 'sometimes|integer|min:5|max:60',
            'extra_km_rate'     => "nullable|required_if_accepted:offers_car|integer|min:0|max:{$g['extra_km_max']}",
        ];
    }

    public static function rateMessages(): array
    {
        $g = self::settings();
        $rwf = fn (int $n) => number_format($n) . ' RWF';

        return [
            'hourly_rate.min'       => "Jali's hourly rate range is {$rwf($g['hourly_min'])}–{$rwf($g['hourly_max'])}.",
            'hourly_rate.max'       => "Jali's hourly rate range is {$rwf($g['hourly_min'])}–{$rwf($g['hourly_max'])}.",
            'daily_rate.min'        => "Jali's daily rate range is {$rwf($g['daily_min'])}–{$rwf($g['daily_max'])}.",
            'daily_rate.max'        => "Jali's daily rate range is {$rwf($g['daily_min'])}–{$rwf($g['daily_max'])}.",
            'overtime_per_hour.max' => "Overtime can be at most {$rwf($g['overtime_max'])} per hour.",
            'out_of_town_fee.max'   => "The out-of-town fee can be at most {$rwf($g['out_of_town_max'])} per day.",
            'car_hourly_rate.max'   => "With your car, the hourly rate can be at most {$rwf($g['car_hourly_max'])}.",
            'extra_km_rate.max'     => "The extra-km rate can be at most {$rwf($g['extra_km_max'])} per km.",
        ];
    }
}
