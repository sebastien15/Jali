<?php

namespace App\Modules\Rentals\Application;

use App\Models\CarRental;
use App\Models\RentalBlock;
use App\Models\RentalBooking;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * When a rental car is free (story S24.2). A car is held by requested, accepted
 * and active bookings and by the owner's blocked days (Kigali calendar dates).
 */
class RentalAvailability
{
    public const TZ = 'Africa/Kigali';

    public static function isFree(CarRental $car, CarbonInterface $start, CarbonInterface $end, ?int $exceptBookingId = null): bool
    {
        $booked = RentalBooking::where('car_rental_id', $car->id)
            ->whereIn('status', RentalBooking::HOLDING)
            ->when($exceptBookingId, fn ($q) => $q->where('id', '!=', $exceptBookingId))
            ->where('start_at', '<', $end)->where('end_at', '>', $start)
            ->exists();
        if ($booked) {
            return false;
        }

        [$from, $to] = self::localDates($start, $end);

        return !RentalBlock::where('car_rental_id', $car->id)
            ->where('start_date', '<=', $to)->where('end_date', '>=', $from)
            ->exists();
    }

    /** Car ids among $carIds that are busy between $start and $end */
    public static function busyCarIds(iterable $carIds, CarbonInterface $start, CarbonInterface $end): array
    {
        $ids = collect($carIds)->all();
        [$from, $to] = self::localDates($start, $end);

        return RentalBooking::whereIn('car_rental_id', $ids)->whereIn('status', RentalBooking::HOLDING)
            ->where('start_at', '<', $end)->where('end_at', '>', $start)->pluck('car_rental_id')
            ->merge(RentalBlock::whereIn('car_rental_id', $ids)->where('start_date', '<=', $to)
                ->where('end_date', '>=', $from)->pluck('car_rental_id'))
            ->unique()->values()->all();
    }

    /**
     * Busy periods for the calendar (next $days days): bookings show only dates,
     * never who booked.
     */
    public static function busyRanges(CarRental $car, int $days = 120): Collection
    {
        $from = now();
        $to = now()->addDays($days);

        $bookings = RentalBooking::where('car_rental_id', $car->id)->whereIn('status', RentalBooking::HOLDING)
            ->where('end_at', '>', $from)->where('start_at', '<', $to)->orderBy('start_at')->get()
            ->map(fn (RentalBooking $b) => [
                'start'  => $b->start_at->toIso8601String(),
                'end'    => $b->end_at->toIso8601String(),
                'kind'   => 'booked',
            ]);
        $blocks = RentalBlock::where('car_rental_id', $car->id)
            ->where('end_date', '>=', $from->copy()->setTimezone(self::TZ)->toDateString())
            ->where('start_date', '<=', $to->copy()->setTimezone(self::TZ)->toDateString())
            ->orderBy('start_date')->get()
            ->map(fn (RentalBlock $b) => [
                'start' => Carbon::parse($b->start_date->toDateString(), self::TZ)->startOfDay()->utc()->toIso8601String(),
                'end'   => Carbon::parse($b->end_date->toDateString(), self::TZ)->endOfDay()->utc()->toIso8601String(),
                'kind'  => 'blocked',
            ]);

        return $bookings->concat($blocks)->sortBy('start')->values();
    }

    /** Kigali calendar dates (Y-m-d) covered by an instant range */
    public static function localDates(CarbonInterface $start, CarbonInterface $end): array
    {
        return [
            $start->copy()->setTimezone(self::TZ)->toDateString(),
            $end->copy()->subSecond()->setTimezone(self::TZ)->toDateString(),
        ];
    }
}
