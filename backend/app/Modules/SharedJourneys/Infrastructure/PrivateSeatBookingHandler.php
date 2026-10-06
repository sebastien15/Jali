<?php

namespace App\Modules\SharedJourneys\Infrastructure;

use App\Models\PrivateSeat;
use App\Modules\LegacyBookings\Contracts\BookableOffer;
use App\Modules\LegacyBookings\Contracts\BookingRequest;
use App\Modules\LegacyBookings\Contracts\BookingTypeHandler;

/**
 * Generic booking rules for type `private` (private seat listings, reference_id = private_seats.id).
 * Owned by SharedJourneys; registered with the LegacyBookings dispatcher (M03-Shared).
 */
class PrivateSeatBookingHandler implements BookingTypeHandler
{
    public function type(): string
    {
        return 'private';
    }

    public function offer(BookingRequest $request): ?BookableOffer
    {
        $item = PrivateSeat::lockForUpdate()->find($request->referenceId);
        if (!$item || !($item->active ?? true)) {
            return null;
        }

        $quantity = $request->quantity ?? 1;
        $unitPrice = (int) $item->price;

        return new BookableOffer(
            capacity: (int) $item->seats,
            quantity: $quantity,
            price: $unitPrice * $quantity,
            // Distance-based fee computed on the device (300–500 RWF tiers)
            serviceFee: max(300, min(500, $request->clientServiceFee ?? 500)),
            title: "{$item->driver} · {$item->from} → {$item->to}",
            sub: "Departs {$item->dep}",
            originCity: $item->from ?? null,
        );
    }
}
