<?php

namespace App\Http\Controllers;

use App\Models\Vehicle;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * A driver's vehicles (story S1.3). Only the active vehicle is shown to riders.
 */
class VehicleController extends Controller
{
    public const PHOTO_SLOTS = ['front', 'side', 'interior', 'luggage'];

    /** GET /driver/vehicles */
    public function index(Request $request)
    {
        return response()->json($request->user()->vehicles()->orderByDesc('is_active')->orderBy('id')->get());
    }

    /** POST /driver/vehicles */
    public function store(Request $request)
    {
        $user = $request->user();
        $validated = $this->validated($request, null);

        $vehicle = DB::transaction(function () use ($user, $validated) {
            // First vehicle becomes the active one automatically
            $isFirst = !$user->vehicles()->exists();

            return $user->vehicles()->create($validated + ['is_active' => $isFirst]);
        });

        return response()->json($vehicle->fresh(), 201);
    }

    /** PATCH /driver/vehicles/{id} */
    public function update(Request $request, int $id)
    {
        $vehicle = $this->owned($request, $id);
        $vehicle->update($this->validated($request, $vehicle));

        return response()->json($vehicle->fresh());
    }

    /** DELETE /driver/vehicles/{id} */
    public function destroy(Request $request, int $id)
    {
        $vehicle = $this->owned($request, $id);
        foreach ((array) $vehicle->photos as $url) {
            $this->deleteStoredPhoto($url);
        }
        $vehicle->delete();

        return response()->json(['message' => 'Vehicle removed']);
    }

    /** POST /driver/vehicles/{id}/activate — the one vehicle riders will see */
    public function activate(Request $request, int $id)
    {
        $vehicle = $this->owned($request, $id);

        DB::transaction(function () use ($request, $vehicle) {
            $request->user()->vehicles()->where('id', '!=', $vehicle->id)->update(['is_active' => false]);
            $vehicle->update(['is_active' => true]);
        });

        return response()->json($vehicle->fresh());
    }

    /** POST /driver/vehicles/{id}/photos (multipart: slot, photo) */
    public function uploadPhoto(Request $request, int $id)
    {
        $vehicle = $this->owned($request, $id);
        $validated = $request->validate([
            'slot'  => ['required', Rule::in(self::PHOTO_SLOTS)],
            'photo' => 'required|image|mimes:jpg,jpeg,png,webp,heic,heif|max:8192',
        ]);

        $photos = (array) ($vehicle->photos ?? []);
        if (!empty($photos[$validated['slot']])) {
            $this->deleteStoredPhoto($photos[$validated['slot']]);
        }
        $path = $request->file('photo')->store("vehicles/{$vehicle->id}", 'public');
        $photos[$validated['slot']] = Storage::url($path);
        $vehicle->update(['photos' => $photos]);

        return response()->json($vehicle->fresh());
    }

    private function owned(Request $request, int $id): Vehicle
    {
        // 404 (not 403) for other drivers' vehicles: don't reveal that the id exists
        return $request->user()->vehicles()->findOrFail($id);
    }

    private function validated(Request $request, ?Vehicle $vehicle): array
    {
        if ($request->filled('plate')) {
            $request->merge(['plate' => Vehicle::normalizePlate($request->input('plate'))]);
        }
        $required = $vehicle ? 'sometimes' : 'required';

        $validated = $request->validate([
            'class'            => [$required, Rule::in(Vehicle::CLASSES)],
            'body_type'        => 'sometimes|nullable|string|in:Sedan,SUV,Minivan,Pickup,Hatchback,Motorcycle',
            'make'             => 'sometimes|nullable|string|max:50',
            'model'            => "$required|string|max:100",
            'color'            => 'sometimes|nullable|string|max:30',
            'year'             => 'sometimes|nullable|integer|min:1980|max:' . (now()->year + 1),
            'plate'            => [$required, 'string', 'max:20', Rule::unique('vehicles', 'plate')->ignore($vehicle?->id)],
            'seats'            => "$required|integer|min:1|max:60",
            'amenities'        => 'sometimes|nullable|array',
            'amenities.*'      => 'string|max:50',
            'insurance_expiry' => "$required|date_format:Y-m-d",
        ], [
            'plate.unique'                 => 'This plate number is already registered on Jali.',
            'insurance_expiry.date_format' => 'Use the format YYYY-MM-DD, e.g. 2026-12-31.',
        ]);

        $class = $validated['class'] ?? $vehicle?->class;
        $seats = $validated['seats'] ?? $vehicle?->seats;
        if ($class === 'moto' && $seats > 2) {
            abort(response()->json([
                'message' => 'A moto can carry at most 2 people.',
                'errors'  => ['seats' => ['A moto can carry at most 2 people.']],
            ], 422));
        }

        return $validated;
    }

    private function deleteStoredPhoto(?string $url): void
    {
        $prefix = Storage::url('');
        if ($url && str_starts_with($url, $prefix)) {
            Storage::disk('public')->delete(substr($url, strlen($prefix)));
        }
    }
}
