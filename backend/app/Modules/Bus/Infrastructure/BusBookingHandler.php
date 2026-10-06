<?php

namespace App\Modules\Bus\Infrastructure;

use App\Models\Bus;
use App\Modules\LegacyBookings\Contracts\BookableOffer;
use App\Modules\LegacyBookings\Contracts\BookingRequest;
use App\Modules\LegacyBookings\Contracts\BookingTypeHandler;

/**
 * Generic booking rules for type `bus` (legacy bus listings, reference_id = buses.id).
 * Owned by Bus; registered with the LegacyBookings dispatcher (M03-Bus).
 */
class BusBookingHandler implements BookingTypeHandler
{
    public function type(): string
    {
        return 'bus';
    }

    public function offer(BookingRequest $request): ?BookableOffer
    {
        $item = Bus::lockForUpdate()->find($request->referenceId);
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
            serviceFee: 0,   // S7.4: no Jali fees
            title: "{$item->agency} · {$item->from} → {$item->to}",
            sub: "Departs {$item->dep}",
            originCity: $item->from ?? null,
        );
    }
}
