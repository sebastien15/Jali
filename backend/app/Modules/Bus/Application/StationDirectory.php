<?php

namespace App\Modules\Bus\Application;

use App\Models\AdminStation;
use App\Models\AgencyRoute;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Bus stations/terminals (`admin_stations`): the public station picker
 * (/stations) and superadmin station management (/admin/stations/**).
 * Input is validated by the transport adapter.
 */
class StationDirectory
{
    /**
     * Every station. Without $withStaff the list is the passengers' station
     * picker: never expose which staff member runs a station or their email.
     */
    public function list(bool $withStaff): Collection
    {
        $stations = AdminStation::with('user')->get()->map(fn($s) => $this->format($s));

        if (!$withStaff) {
            $stations = $stations->map(fn ($s) => collect($s)->except(['admin_id', 'admin_name', 'admin_email'])->all());
        }

        return $stations;
    }

    public function create(array $data): array
    {
        $this->assertStaff($data['admin_id'] ?? null);

        $station = AdminStation::create([
            'city'      => $data['city'],
            'district'  => $data['district'] ?? null,
            'type'      => $data['type'] ?? 'bus_station',
            'address'   => $data['address'] ?? null,
            'latitude'  => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'image_url' => $data['image_url'] ?? null,
            'user_id'   => $data['admin_id'] ?? null,
            'name'      => $data['name'] ?? null,
            'province'  => $data['province'] ?? null,
            'aliases'   => $data['aliases'] ?? null,
        ]);

        return $this->format($station);
    }

    /** @throws \Illuminate\Database\Eloquent\ModelNotFoundException */
    public function find(int|string $id): AdminStation
    {
        return AdminStation::findOrFail($id);
    }

    /** Keys absent from $data keep their current value. */
    public function update(AdminStation $station, array $data): array
    {
        $this->assertStaff($data['admin_id'] ?? null);

        $station->update([
            'city'      => $data['city']      ?? $station->city,
            'district'  => array_key_exists('district', $data)  ? $data['district']  : $station->district,
            'type'      => $data['type']      ?? $station->type,
            'address'   => array_key_exists('address', $data)   ? $data['address']   : $station->address,
            'latitude'  => array_key_exists('latitude', $data)  ? $data['latitude']  : $station->latitude,
            'longitude' => array_key_exists('longitude', $data) ? $data['longitude'] : $station->longitude,
            'image_url' => array_key_exists('image_url', $data) ? $data['image_url'] : $station->image_url,
            'user_id'   => array_key_exists('admin_id', $data)  ? $data['admin_id']  : $station->user_id,
            'name'      => array_key_exists('name', $data)      ? $data['name']      : $station->name,
            'province'  => array_key_exists('province', $data)  ? $data['province']  : $station->province,
            'aliases'   => array_key_exists('aliases', $data)   ? $data['aliases']   : $station->aliases,
        ]);

        return $this->format($station);
    }

    /**
     * Routes reference stations with cascading FKs: deleting a terminal would
     * silently delete every route and departure through it.
     *
     * @throws BusRequestRejected
     */
    public function delete(int|string $id): void
    {
        $station = AdminStation::findOrFail($id);

        $inUse = AgencyRoute::where('from_station_id', $station->id)->orWhere('to_station_id', $station->id)->exists();
        if ($inUse) {
            throw new BusRequestRejected(409, ['message' => 'Remove or reassign the routes using this station first.']);
        }

        $station->delete();
    }

    /** Only admins/superadmins can be assigned to run a station. */
    private function assertStaff(?int $userId): void
    {
        if ($userId === null) {
            return;
        }
        abort_unless(User::find($userId)?->isAdmin(), 422, 'Only admin accounts can be assigned to a station.');
    }

    private function format(AdminStation $s): array
    {
        $s->loadMissing('user');
        return [
            'id'          => $s->id,
            'name'        => $s->name,
            'aliases'     => $s->aliases ?? [],
            'city'        => $s->city,
            'province'    => $s->province,
            'district'    => $s->district,
            'type'        => $s->type ?? 'bus_station',
            'address'     => $s->address,
            'latitude'    => $s->latitude,
            'longitude'   => $s->longitude,
            'image_url'   => $s->image_url,
            'admin_id'    => $s->user_id,
            'admin_name'  => $s->user?->name,
            'admin_email' => $s->user?->email,
        ];
    }
}
