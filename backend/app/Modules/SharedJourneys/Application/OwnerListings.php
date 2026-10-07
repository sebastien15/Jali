<?php

namespace App\Modules\SharedJourneys\Application;

use App\Models\PrivateSeat;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A provider's own private-seat listings (/driver/listings/**).
 * Input arrays are already validated by the transport adapter.
 */
class OwnerListings
{
    public function listingsOf(User $owner): Collection
    {
        return PrivateSeat::where('user_id', $owner->id)
            ->with('stops')
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
        $stops = self::withRouteFromStops($validated);

        return DB::transaction(function () use ($validated, $stops) {
            $listing = PrivateSeat::create($validated);
            if ($stops) {
                $this->saveStops($listing, $stops);
            }

            return $listing->load('stops');
        });
    }

    /** @throws InvalidListingDate */
    public function update(PrivateSeat $listing, array $validated): PrivateSeat
    {
        $validated = self::withNormalizedDate($validated);
        $stops = self::withRouteFromStops($validated);
        DB::transaction(function () use ($listing, $validated, $stops) {
            $listing->update($validated);
            if ($stops !== null) {
                $this->saveStops($listing, $stops);
            }
        });

        return $listing->fresh('stops');
    }

    public function delete(PrivateSeat $listing): void
    {
        $listing->delete();
    }

    /**
     * S25.1: with stops, the listing's from/to/dep/pickup/price come from them
     * (first stop, last stop, first time, full-route fare) so older clients and
     * the catalogue keep seeing a plain from → to listing.
     *
     * @return array|null the stops, or null when the request has none
     */
    private static function withRouteFromStops(array &$validated): ?array
    {
        if (!array_key_exists('stops', $validated)) {
            return null;
        }
        $stops = array_values($validated['stops'] ?? []);
        unset($validated['stops']);
        if (!$stops) {
            return [];
        }
        foreach ($stops as $i => $stop) {
            if ($i > 0 && strcmp($stop['time'], $stops[$i - 1]['time']) < 0) {
                throw ValidationException::withMessages(["stops.$i.time" => 'Each stop must be at or after the previous one.']);
            }
            if ($i < count($stops) - 1 && !isset($stop['fare_to_next'])) {
                throw ValidationException::withMessages(["stops.$i.fare_to_next" => 'Set the fare to the next stop.']);
            }
        }
        $last = count($stops) - 1;
        $validated['from'] = $stops[0]['name'];
        $validated['pickup_station'] = $validated['pickup_station'] ?? $stops[0]['name'];
        $validated['to'] = $stops[$last]['name'];
        $validated['drop_location'] = $validated['drop_location'] ?? $stops[$last]['name'];
        $validated['dep'] = $stops[0]['time'];
        $validated['price'] = array_sum(array_map(fn ($s) => (int) ($s['fare_to_next'] ?? 0), array_slice($stops, 0, $last)));

        return $stops;
    }

    private function saveStops(PrivateSeat $listing, array $stops): void
    {
        $listing->stops()->delete();
        $last = count($stops) - 1;
        foreach ($stops as $i => $stop) {
            $listing->stops()->create([
                'seq' => $i, 'name' => $stop['name'], 'lat' => $stop['lat'] ?? null, 'lng' => $stop['lng'] ?? null,
                'time' => $stop['time'], 'fare_to_next' => $i < $last ? (int) $stop['fare_to_next'] : null,
            ]);
        }
    }

    private static function withNormalizedDate(array $validated): array
    {
        if (array_key_exists('date', $validated) && ($validated['date'] = ListingDate::normalize($validated['date'])) === false) {
            throw new InvalidListingDate();
        }

        return $validated;
    }
}
