<?php

namespace App\Modules\DriverHire\Application;

use App\Models\DriverAvailability;
use App\Models\DriverHire;
use Carbon\CarbonInterface;
use Carbon\CarbonPeriod;

/**
 * Is a driver free for a time window? (story S6.2)
 * - Blocked dates are never bookable.
 * - With weekly hours set, every day must be a working day, and a single-day
 *   booking must fit inside that day's hours. No weekly hours = any time.
 * - Accepted or started hires hold the driver's time.
 * All calendar logic uses Kigali time.
 */
class HireAvailability
{
    public const TZ = 'Africa/Kigali';

    public static function isFree(int $driverId, CarbonInterface $start, CarbonInterface $end, ?int $ignoreHireId = null): bool
    {
        return self::fitsSchedule($driverId, $start, $end) && !self::overlapsBooking($driverId, $start, $end, $ignoreHireId);
    }

    public static function overlapsBooking(int $driverId, CarbonInterface $start, CarbonInterface $end, ?int $ignoreHireId = null): bool
    {
        return DriverHire::where('driver_id', $driverId)
            ->whereIn('status', DriverHire::BOOKED)
            ->when($ignoreHireId, fn ($q) => $q->whereKeyNot($ignoreHireId))
            ->where('start_at', '<', $end)
            ->where('end_at', '>', $start)
            ->exists();
    }

    public static function fitsSchedule(int $driverId, CarbonInterface $start, CarbonInterface $end): bool
    {
        $rows = DriverAvailability::where('user_id', $driverId)->get();
        $localStart = $start->copy()->setTimezone(self::TZ);
        $localEnd = $end->copy()->setTimezone(self::TZ)->subSecond();
        $dates = collect(CarbonPeriod::create($localStart->copy()->startOfDay(), $localEnd->copy()->startOfDay()))
            ->map(fn ($d) => $d->toDateString());

        $blocked = $rows->where('is_blocked', true)->pluck('date')->map(fn ($d) => $d?->toDateString())->filter();
        if ($dates->intersect($blocked)->isNotEmpty()) {
            return false;
        }

        $weekly = $rows->whereNotNull('weekday')->keyBy('weekday');
        if ($weekly->isEmpty()) {
            return true;
        }
        foreach ($dates as $date) {
            if (!$weekly->has(\Carbon\Carbon::parse($date, self::TZ)->dayOfWeek)) {
                return false;
            }
        }
        if ($dates->count() === 1) {
            $day = $weekly->get($localStart->dayOfWeek);
            $from = substr((string) $day->start_time, 0, 5);
            $to = substr((string) $day->end_time, 0, 5);

            return $localStart->format('H:i') >= $from && $end->copy()->setTimezone(self::TZ)->format('H:i') <= $to
                && $end->copy()->setTimezone(self::TZ)->isSameDay($localStart);
        }

        return true;
    }
}
