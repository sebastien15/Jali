<?php

namespace App\Modules\Rentals\Application;

use App\Models\CarRental;
use App\Models\RentalBlock;
use App\Models\RentalBooking;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * A provider's own rental cars (/driver/cars/**). Rental cars are a separate
 * resource from the provider's driving Vehicles (Providers/Fleet) — never merged.
 * New and re-submitted listings wait for admin verification (S24.8) before
 * customers can see them. Input arrays are already validated by the transport adapter.
 */
class OwnerFleet
{
    public function carsOf(User $owner): Collection
    {
        return CarRental::where('user_id', $owner->id)->orderByDesc('id')->get();
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
        $this->assertPlateFree($validated['plate']);

        return CarRental::create(array_merge([
            'caution'             => 0,
            'amenities'           => [],
            'photos'              => [],
            'allowed'             => RentalCarForm::allowed(null),
            'rules'               => [],
        ], RentalCarForm::attributes($validated), [
            'user_id'             => $owner->id,
            'rating'              => 0,
            'active'              => true,
            'status'              => 'available',
            'verification_status' => CarRental::PENDING,
        ]));
    }

    public function update(CarRental $car, array $validated): CarRental
    {
        $attributes = RentalCarForm::attributes($validated);
        if (isset($attributes['plate']) && $attributes['plate'] !== $car->plate) {
            $this->assertPlateFree($attributes['plate'], $car->id);
            // A different plate is a different car to verify
            $attributes['verification_status'] = CarRental::PENDING;
        } elseif ($car->verification_status === CarRental::REJECTED) {
            // Fixing a rejected listing sends it back for review
            $attributes['verification_status'] = CarRental::PENDING;
        }

        $car->update($attributes);

        return $car->fresh();
    }

    public function delete(CarRental $car): void
    {
        if ($car->bookings()->whereIn('status', RentalBooking::OPEN)->exists()) {
            throw new HttpException(409, 'This car has open rentals. Finish or cancel them before removing it.');
        }
        foreach ((array) $car->photos as $url) {
            $this->deletePublicFile($url);
        }
        foreach ((array) $car->documents as $path) {
            Storage::disk('local')->delete($path);
        }
        $car->delete();
    }

    // ── photos (public) ─────────────────────────────────────────────────

    public function addPhoto(CarRental $car, UploadedFile $file): CarRental
    {
        $photos = array_values((array) $car->photos);
        if (count($photos) >= RentalCarForm::MAX_PHOTOS) {
            throw new HttpException(422, 'A car can have up to ' . RentalCarForm::MAX_PHOTOS . ' photos.');
        }
        $path = $file->store("rental-cars/{$car->id}", 'public');
        $photos[] = Storage::url($path);
        $car->update(['photos' => $photos]);

        return $car->fresh();
    }

    public function removePhoto(CarRental $car, int $index): CarRental
    {
        $photos = array_values((array) $car->photos);
        abort_unless(isset($photos[$index]), 404, 'Photo not found.');
        $this->deletePublicFile($photos[$index]);
        array_splice($photos, $index, 1);
        $car->update(['photos' => $photos]);

        return $car->fresh();
    }

    /** Moves a photo to the front: the first photo is the cover */
    public function makeCover(CarRental $car, int $index): CarRental
    {
        $photos = array_values((array) $car->photos);
        abort_unless(isset($photos[$index]), 404, 'Photo not found.');
        $cover = $photos[$index];
        array_splice($photos, $index, 1);
        array_unshift($photos, $cover);
        $car->update(['photos' => $photos]);

        return $car->fresh();
    }

    // ── documents (private) ─────────────────────────────────────────────

    public function uploadDocument(CarRental $car, string $type, UploadedFile $file): CarRental
    {
        $documents = (array) $car->documents;
        if (!empty($documents[$type])) {
            Storage::disk('local')->delete($documents[$type]);
        }
        $documents[$type] = $file->store("rental-documents/{$car->id}", 'local');
        $attributes = ['documents' => $documents];
        if ($car->verification_status !== CarRental::PENDING) {
            $attributes['verification_status'] = CarRental::PENDING;   // new papers are checked again
        }
        $car->update($attributes);

        return $car->fresh();
    }

    /** Private path of a car document for its owner or a rental reviewer; 404 otherwise */
    public function readableDocumentPath(User $viewer, CarRental $car, string $type): string
    {
        abort_unless($car->user_id === $viewer->id || $viewer->hasPermission('manage-rentals'), 404);
        $path = ((array) $car->documents)[$type] ?? null;
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return $path;
    }

    // ── blocked dates ───────────────────────────────────────────────────

    public function addBlock(CarRental $car, array $data): RentalBlock
    {
        $start = \Carbon\Carbon::parse($data['start_date'], RentalAvailability::TZ)->startOfDay();
        $end = \Carbon\Carbon::parse($data['end_date'], RentalAvailability::TZ)->endOfDay();
        $clash = RentalBooking::where('car_rental_id', $car->id)->whereIn('status', RentalBooking::HOLDING)
            ->where('start_at', '<', $end->copy()->utc())->where('end_at', '>', $start->copy()->utc())->exists();
        if ($clash) {
            throw new HttpException(409, 'A rental is booked on these days. Cancel it first or pick other days.');
        }

        return $car->blocks()->create([
            'start_date' => $data['start_date'],
            'end_date'   => $data['end_date'],
            'reason'     => $data['reason'] ?? null,
        ]);
    }

    public function removeBlock(CarRental $car, int $blockId): void
    {
        $car->blocks()->whereKey($blockId)->firstOrFail()->delete();
    }

    private function assertPlateFree(string $plate, ?int $exceptId = null): void
    {
        $plate = strtoupper(trim($plate));
        $taken = CarRental::where('plate', $plate)->where('active', true)
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))->exists();
        if ($taken) {
            throw \Illuminate\Validation\ValidationException::withMessages(['plate' => 'Another listed car already has this plate.']);
        }
    }

    private function deletePublicFile(?string $url): void
    {
        if ($url && str_starts_with($url, Storage::url(''))) {
            Storage::disk('public')->delete(substr($url, strlen(Storage::url(''))));
        }
    }
}
