<?php

namespace App\Modules\SharedJourneys\Application;

use App\Models\PrivateSeat;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * A provider's own private-seat listings (/driver/listings/**).
 * Input arrays are already validated by the transport adapter.
 */
class OwnerListings
{
    public function listingsOf(User $owner): Collection
    {
        return PrivateSeat::where('user_id', $owner->id)
            ->latest()
            ->get();
    }

    /** @throws \Illuminate\Database\Eloquent\ModelNotFoundException when the listing is not the owner's */
    public function findOwned(User $owner, int|string $id): PrivateSeat
    {
        return PrivateSeat::where('id', $id)
            ->where('user_id', $owner->id)
            ->firstOrFail();
    }

    /** @throws InvalidListingDate */
    public function create(User $owner, array $validated): PrivateSeat
    {
        $validated = self::withNormalizedDate($validated);

        $validated['user_id'] = $owner->id;
        $validated['driver']  = $owner->name;
        $validated['active']  = true;

        return PrivateSeat::create($validated);
    }

    /** @throws InvalidListingDate */
    public function update(PrivateSeat $listing, array $validated): PrivateSeat
    {
        $listing->update(self::withNormalizedDate($validated));

        return $listing->fresh();
    }

    public function delete(PrivateSeat $listing): void
    {
        $listing->delete();
    }

    private static function withNormalizedDate(array $validated): array
    {
        if (array_key_exists('date', $validated) && ($validated['date'] = ListingDate::normalize($validated['date'])) === false) {
            throw new InvalidListingDate();
        }

        return $validated;
    }
}
