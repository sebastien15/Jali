<?php

namespace App\Modules\Locations\Application;

use App\Models\Location;
use App\Modules\Locations\Contracts\TerminalNetwork;
use Illuminate\Support\Collection;

/**
 * Booking pickup locations (`locations`; bookings.location_id, the admin's
 * users.location_id) managed under /admin/locations/**. Network details
 * (province, corridors, agencies) come from the TerminalNetwork port.
 * Input is validated by the transport adapter.
 */
class PickupLocations
{
    public function __construct(private readonly TerminalNetwork $network)
    {
    }

    /**
     * Locations ordered by city then name, each enriched with its terminal's
     * province and corridors. Each key present in $filters (`type`, `city`)
     * is matched exactly, as the old `$request->has()` checks did.
     */
    public function list(array $filters): Collection
    {
        $query = Location::query();

        if (array_key_exists('type', $filters)) {
            $query->where('type', $filters['type']);
        }
        if (array_key_exists('city', $filters)) {
            $query->where('city', $filters['city']);
        }

        $locations = $query->orderBy('city')->orderBy('name')->get();

        $terminalData = $this->network->byTerminalName($locations->pluck('name')->toArray());

        return $locations->map(function ($loc) use ($terminalData) {
            $data = $terminalData[$loc->name] ?? null;
            return array_merge($loc->toArray(), [
                'province'  => $data['province'] ?? null,
                'corridors' => $data['corridors'] ?? [],
            ]);
        });
    }

    public function create(array $data): Location
    {
        return Location::create($data);
    }

    /** @throws \Illuminate\Database\Eloquent\ModelNotFoundException */
    public function find(int|string $id): Location
    {
        return Location::findOrFail($id);
    }

    public function update(Location $location, array $data): Location
    {
        $location->update($data);
        return $location;
    }

    /**
     * Delete a location nobody depends on.
     *
     * @return string|null the refusal message, or null when deleted
     */
    public function delete(int|string $id): ?string
    {
        $location = Location::findOrFail($id);

        // Check if any admin is assigned here
        if ($location->admins()->exists()) {
            return 'Cannot delete: admins are assigned to this location.';
        }

        // Check if any bookings reference this location
        if ($location->bookings()->exists()) {
            return 'Cannot delete: bookings reference this location.';
        }

        $location->delete();
        return null;
    }
}
