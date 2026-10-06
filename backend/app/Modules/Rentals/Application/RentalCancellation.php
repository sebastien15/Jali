<?php

namespace App\Modules\Rentals\Application;

use App\Models\RentalBooking;
use Carbon\CarbonInterface;

/**
 * Customer cancellation fee for an accepted rental, by the owner's policy (story S24.5).
 * Requests not yet accepted are always free. The fee is owed to the owner, not to Jali.
 *
 *   flexible  free until 24 h before pickup, then one day's price
 *   moderate  free until 3 days before pickup, then half of the total
 *   strict    free until 7 days before pickup, then half; under 24 h the full total
 */
class RentalCancellation
{
    public static function customerFee(RentalBooking $booking, CarbonInterface $now): int
    {
        if ($booking->status !== RentalBooking::ACCEPTED) {
            return 0;
        }
        $hours = $now->diffInHours($booking->start_at, false);
        $total = (int) $booking->total;
        $day = (int) ($booking->quote['price_per_day'] ?? 0);

        return match ($booking->terms['cancellation_policy'] ?? 'moderate') {
            'flexible' => $hours >= 24 ? 0 : min($day, $total),
            'strict'   => $hours >= 168 ? 0 : ($hours >= 24 ? (int) round($total / 2) : $total),
            default    => $hours >= 72 ? 0 : (int) round($total / 2),
        };
    }
}
