<?php

namespace App\Modules\Bus\Application;

use App\Models\Bus;
use Illuminate\Database\Eloquent\Collection;

/**
 * Admin CRUD for legacy `buses` listings (Admin\AdminBusController).
 * Note: no route points at that controller today (routes-baseline.json);
 * kept for parity until there is evidence to remove it. Input is validated
 * by the transport adapter.
 */
class BusFleet
{
    public function all(): Collection
    {
        return Bus::orderBy('agency')->orderBy('dep')->get();
    }

    /** @throws \Illuminate\Database\Eloquent\ModelNotFoundException */
    public function find(int|string $id): Bus
    {
        return Bus::findOrFail($id);
    }

    public function create(array $validated): Bus
    {
        return Bus::create(array_merge($validated, ['active' => $validated['active'] ?? true]));
    }

    public function update(Bus $bus, array $validated): Bus
    {
        $bus->update($validated);
        return $bus;
    }

    public function delete(Bus $bus): void
    {
        $bus->delete();
    }
}
