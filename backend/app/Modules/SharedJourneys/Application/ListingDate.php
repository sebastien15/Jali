<?php

namespace App\Modules\SharedJourneys\Application;

use Illuminate\Support\Carbon;

final class ListingDate
{
    /**
     * Listing dates arrive as "Today", "Mon 5 Oct 2026", "2026-10-05"…
     * Store/compare them as Y-m-d (Africa/Kigali). null = no date, false = invalid.
     */
    public static function normalize(?string $raw): string|null|false
    {
        if ($raw === null || trim($raw) === '') {
            return null;
        }
        $tz = 'Africa/Kigali';
        try {
            return match (strtolower(trim($raw))) {
                'today'    => now($tz)->toDateString(),
                'tomorrow' => now($tz)->addDay()->toDateString(),
                default    => Carbon::parse($raw, $tz)->toDateString(),
            };
        } catch (\Throwable) {
            return false;
        }
    }
}
