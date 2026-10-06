<?php

namespace App\Modules\DriverHire\Application;

use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

/** When a hire may start and how long it may last (story S6.3). */
class HireBookingWindow
{
    /** Longest day booking, from the shared pricing policy */
    public static function maxDays(): int
    {
        return (int) HireQuote::settings()['max_days'];
    }

    /** Requested start in UTC, seconds dropped: at least 30 minutes and at most 90 days ahead */
    public static function start(array $data): Carbon
    {
        $start = Carbon::parse($data['start_at'])->utc()->seconds(0);
        if ($start->lt(now()->addMinutes(30))) {
            throw ValidationException::withMessages(['start_at' => 'Choose a start time at least 30 minutes from now.']);
        }
        if ($start->gt(now()->addDays(90))) {
            throw ValidationException::withMessages(['start_at' => 'You can book up to 90 days ahead.']);
        }

        return $start;
    }
}
