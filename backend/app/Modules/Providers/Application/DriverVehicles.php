<?php

namespace App\Modules\Providers\Application;

use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Fleet: a provider's own vehicles (story S1.3, /driver/vehicles/**). Only the
 * active vehicle is shown to riders. Distinct from rental listings
 * (Rentals\OwnerFleet, car_rentals): no shared IDs or plates.
 * Input is validated by the transport.
 */
class DriverVehicles
{
    public const PHOTO_SLOTS = ['front', 'side', 'interior', 'luggage'];

    public function list(User $user): Collection
    {
        return $user->vehicles()->orderByDesc('is_active')->orderBy('id')->get();
    }

    /**
     * 404 (not 403) for other drivers' vehicles: don't reveal that the id exists.
     *
     * @throws \Illuminate\Database\Eloquent\ModelNotFoundException
     */
    public function owned(User $user, int $id): Vehicle
    {
        return $user->vehicles()->findOrFail($id);
    }

    /** Message for a class/seats combination no vehicle may have, else null. */
    public function seatsRefusal(?string $class, mixed $seats): ?string
    {
        return $class === 'moto' && $seats > 2 ? 'A moto can carry at most 2 people.' : null;
    }

    public function create(User $user, array $validated): Vehicle
    {
        $vehicle = DB::transaction(function () use ($user, $validated) {
            // First vehicle becomes the active one automatically
            $isFirst = !$user->vehicles()->exists();

            return $user->vehicles()->create($validated + ['is_active' => $isFirst]);
        });

        return $vehicle->fresh();
    }

    public function update(Vehicle $vehicle, array $validated): Vehicle
    {
        $vehicle->update($validated);

        return $vehicle->fresh();
    }

    /** Removes the vehicle and its stored photos. */
    public function delete(Vehicle $vehicle): void
    {
        foreach ((array) $vehicle->photos as $url) {
            $this->deleteStoredPhoto($url);
        }
        $vehicle->delete();
    }

    /** The one vehicle riders will see. */
    public function activate(User $user, Vehicle $vehicle): Vehicle
    {
        DB::transaction(function () use ($user, $vehicle) {
            $user->vehicles()->where('id', '!=', $vehicle->id)->update(['is_active' => false]);
            $vehicle->update(['is_active' => true]);
        });

        return $vehicle->fresh();
    }

    /** Stores the photo publicly for its slot, replacing (and deleting) the previous one. */
    public function setPhoto(Vehicle $vehicle, string $slot, UploadedFile $photo): Vehicle
    {
        $photos = (array) ($vehicle->photos ?? []);
        if (!empty($photos[$slot])) {
            $this->deleteStoredPhoto($photos[$slot]);
        }
        $path = $photo->store("vehicles/{$vehicle->id}", 'public');
        $photos[$slot] = Storage::url($path);
        $vehicle->update(['photos' => $photos]);

        return $vehicle->fresh();
    }

    private function deleteStoredPhoto(?string $url): void
    {
        $prefix = Storage::url('');
        if ($url && str_starts_with($url, $prefix)) {
            Storage::disk('public')->delete(substr($url, strlen($prefix)));
        }
    }
}
