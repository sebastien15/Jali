<?php

namespace App\Http\Controllers;

use App\Models\Vehicle;
use App\Modules\Providers\Application\DriverVehicles;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * A driver's vehicles (story S1.3). Only the active vehicle is shown to riders.
 * Transport adapter for Providers/Fleet (M03-Remaining): validation + HTTP shape only.
 */
class VehicleController extends Controller
{
    public function __construct(private readonly DriverVehicles $vehicles)
    {
    }

    /** GET /driver/vehicles */
    public function index(Request $request)
    {
        return response()->json($this->vehicles->list($request->user()));
    }

    /** POST /driver/vehicles */
    public function store(Request $request)
    {
        $validated = $this->validated($request, null);

        return response()->json($this->vehicles->create($request->user(), $validated), 201);
    }

    /** PATCH /driver/vehicles/{id} */
    public function update(Request $request, int $id)
    {
        $vehicle = $this->vehicles->owned($request->user(), $id);

        return response()->json($this->vehicles->update($vehicle, $this->validated($request, $vehicle)));
    }

    /** DELETE /driver/vehicles/{id} */
    public function destroy(Request $request, int $id)
    {
        $this->vehicles->delete($this->vehicles->owned($request->user(), $id));

        return response()->json(['message' => 'Vehicle removed']);
    }

    /** POST /driver/vehicles/{id}/activate — the one vehicle riders will see */
    public function activate(Request $request, int $id)
    {
        $vehicle = $this->vehicles->owned($request->user(), $id);

        return response()->json($this->vehicles->activate($request->user(), $vehicle));
    }

    /** POST /driver/vehicles/{id}/photos (multipart: slot, photo) */
    public function uploadPhoto(Request $request, int $id)
    {
        $vehicle = $this->vehicles->owned($request->user(), $id);
        $validated = $request->validate([
            'slot'  => ['required', Rule::in(DriverVehicles::PHOTO_SLOTS)],
            'photo' => 'required|image|mimes:jpg,jpeg,png,webp,heic,heif|max:8192',
        ]);

        return response()->json($this->vehicles->setPhoto($vehicle, $validated['slot'], $request->file('photo')));
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

        $refusal = $this->vehicles->seatsRefusal($validated['class'] ?? $vehicle?->class, $validated['seats'] ?? $vehicle?->seats);
        if ($refusal) {
            abort(response()->json([
                'message' => $refusal,
                'errors'  => ['seats' => [$refusal]],
            ], 422));
        }

        return $validated;
    }
}
