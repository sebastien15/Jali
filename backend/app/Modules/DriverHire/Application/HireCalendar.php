<?php

namespace App\Modules\DriverHire\Application;

use App\Models\DriverAvailability;
use App\Models\DriverHire;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * A hire driver's weekly hours, blocked dates and booked time (story S6.2).
 * HireAvailability reads the same rows to decide whether a window is free.
 */
class HireCalendar
{
    /** PUT /driver/availability — replaces the whole calendar (input already validated) */
    public function replace(User $driver, array $validated): void
    {
        DB::transaction(function () use ($driver, $validated) {
            DriverAvailability::where('user_id', $driver->id)->delete();
            foreach ($validated['weekly'] as $day) {
                DriverAvailability::create(['user_id' => $driver->id, 'weekday' => $day['weekday'], 'start_time' => $day['start_time'], 'end_time' => $day['end_time']]);
            }
            foreach ($validated['blocked_dates'] as $date) {
                DriverAvailability::create(['user_id' => $driver->id, 'date' => $date, 'is_blocked' => true]);
            }
        });
    }

    /** GET/PUT /driver/availability response */
    public function payload(User $driver): array
    {
        $rows = DriverAvailability::where('user_id', $driver->id)->get();

        return [
            'weekly' => $rows->whereNotNull('weekday')->sortBy('weekday')->map(fn ($r) => [
                'weekday' => $r->weekday, 'start_time' => substr((string) $r->start_time, 0, 5), 'end_time' => substr((string) $r->end_time, 0, 5),
            ])->values(),
            'blocked_dates' => $rows->where('is_blocked', true)->map(fn ($r) => $r->date?->toDateString())->filter()->sort()->values(),
            'upcoming' => DriverHire::where('driver_id', $driver->id)->whereIn('status', DriverHire::BOOKED)->where('end_at', '>', now())
                ->orderBy('start_at')->limit(50)->get(['id', 'start_at', 'end_at'])
                ->map(fn ($h) => ['id' => $h->id, 'start_at' => $h->start_at->toIso8601String(), 'end_at' => $h->end_at->toIso8601String()]),
        ];
    }
}
