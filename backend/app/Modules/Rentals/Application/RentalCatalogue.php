<?php

namespace App\Modules\Rentals\Application;

use App\Models\CarRental;
use Illuminate\Database\Eloquent\Collection;

/** Public rental catalogue (GET /car-rentals) — admin-seeded and driver-listed cars. */
class RentalCatalogue
{
    /**
     * Active cars their owner marks available, cheapest first.
     *
     * @param mixed $type the raw `type` filter, or null when the request did not fill it
     */
    public function available(mixed $type = null): Collection
    {
        // Cars marked rented / in maintenance by their owner are not offered.
        $query = CarRental::query()->where('active', true)->where('status', 'available');

        if ($type !== null) {
            $query->where('type', $type);
        }

        return $query->orderBy('price')->get();
    }
}
