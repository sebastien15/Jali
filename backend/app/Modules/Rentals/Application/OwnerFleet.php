<?php

namespace App\Modules\Rentals\Application;

use App\Models\CarRental;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * A provider's own rental cars (/driver/cars/**). Rental cars are a separate
 * resource from the provider's driving Vehicles (Providers/Fleet) — never merged.
 * Input arrays are already validated by the transport adapter.
 */
class OwnerFleet
{
    public function carsOf(User $owner): Collection
    {
        return CarRental::where('user_id', $owner->id)->get();
    }

    /** @throws \Illuminate\Database\Eloquent\ModelNotFoundException when the car is not the owner's */
    public function findOwned(User $owner, int|string $id): CarRental
    {
        return CarRental::where('id', $id)
            ->where('user_id', $owner->id)
            ->firstOrFail();
    }

    public function create(User $owner, array $validated): CarRental
    {
        return CarRental::create([
            'user_id'  => $owner->id,
            'name'     => $validated['name'],
            'type'     => $validated['type'],
            'plate'    => $validated['plate'],
            'seats'    => $validated['seats'],
            'price'    => $validated['priceDay'],   // frontend sends priceDay → stored as price
            'caution'  => $validated['caution'] ?? 0,
            'amenities'=> $validated['amenities'] ?? [],
            'photos'   => $validated['photos'] ?? [],
            'rating'   => 0,
            'active'   => true,
        ]);
    }

    public function update(CarRental $car, array $validated): CarRental
    {
        if (isset($validated['priceDay'])) {
            $validated['price'] = $validated['priceDay'];
            unset($validated['priceDay']);
        }

        $car->update($validated);

        return $car->fresh();
    }

    public function delete(CarRental $car): void
    {
        $car->delete();
    }
}
