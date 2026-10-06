<?php

namespace App\Modules\Bus\Infrastructure;

use App\Models\TripDeparture;
use App\Modules\LegacyBookings\Contracts\BookableOffer;
use App\Modules\LegacyBookings\Contracts\BookingRequest;
use App\Modules\LegacyBookings\Contracts\BookingTypeHandler;

/**
 * Generic booking rules for type `trip` (bus departures, reference_id = trip_departures.id).
 * Owned by Bus; registered with the LegacyBookings dispatcher (M03-Bus).
 */
class TripDepartureBookingHandler implements BookingTypeHandler
{
    public function type(): string
    {
        return 'trip';
    }

    public function offer(BookingRequest $request): ?BookableOffer
    {
        $item = TripDeparture::with(['route.agency', 'route.fromStation', 'route.toStation'])
            ->lockForUpdate()->find($request->referenceId);
        if (!$item || !($item->active && $item->route->active)) {
            return null;
        }

        $quantity = $request->quantity ?? 1;
        $unitPrice = (int) $item->route->price;

        return new BookableOffer(
            capacity: (int) $item->route->total_seats,
            quantity: $quantity,
            price: $unitPrice * $quantity,
            serviceFee: max(500, min(3000, (int) round($unitPrice * 0.05))),
            title: "{$item->route->agency->name} · {$item->route->fromStation->city} → {$item->route->toStation->city}",
            sub: 'Departs ' . substr($item->departure_time, 0, 5),
            originCity: $item->route->fromStation->city,
            tripDepartureId: $item->id,
        );
    }
}
