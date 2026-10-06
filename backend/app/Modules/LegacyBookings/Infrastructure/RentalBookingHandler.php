<?php

namespace App\Modules\LegacyBookings\Infrastructure;

use App\Models\CarRental;
use App\Modules\LegacyBookings\Contracts\BookableOffer;
use App\Modules\LegacyBookings\Contracts\BookingRequest;
use App\Modules\LegacyBookings\Contracts\BookingTypeHandler;

/**
 * Generic booking rules for type `rental` (car rentals, reference_id = car_rentals.id).
 * Temporary home until Rentals owns it (runbook M03-Rental).
 */
class RentalBookingHandler implements BookingTypeHandler
{
    public function type(): string
    {
        return 'rental';
    }

    public function offer(BookingRequest $request): ?BookableOffer
    {
        $item = CarRental::lockForUpdate()->find($request->referenceId);
        if (!$item || !($item->active ?? true) || ($item->status ?? 'available') !== 'available') {
            return null;
        }

        $days = $request->days ?? 1;   // a rental is always one car

        return new BookableOffer(
            capacity: 1,
            quantity: 1,
            price: (int) $item->price * $days,
            serviceFee: 300,
            title: "{$item->name} ({$item->type})",
            sub: "{$item->plate} · {$days} day" . ($days > 1 ? 's' : ''),
            originCity: $item->from ?? null,
        );
    }
}
