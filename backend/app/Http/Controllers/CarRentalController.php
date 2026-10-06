<?php

namespace App\Http\Controllers;

use App\Models\CarRental;
use App\Modules\Rentals\Application\OwnerFleet;
use App\Modules\Rentals\Application\RentalAvailability;
use App\Modules\Rentals\Application\RentalCarForm;
use App\Modules\Rentals\Application\RentalCarPresenter;
use App\Modules\Rentals\Application\RentalCatalogue;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/** Transport adapter for Rentals (runbook M03-Rental): validation + HTTP shape only. */
class CarRentalController extends Controller
{
    public function __construct(
        private readonly RentalCatalogue $catalogue,
        private readonly OwnerFleet $fleet,
    ) {
    }

    /**
     * GET /car-rentals
     * Public catalog — admin-seeded and verified owner-listed active cars.
     */
    public function index(Request $request)
    {
        return response()->json($this->catalogue->available($request->filled('type') ? $request->type : null));
    }

    /** GET /driver/cars — the owner's own fleet */
    public function driverCars(Request $request)
    {
        $cars = $this->fleet->carsOf($request->user());

        return response()->json($cars->map(fn($c) => RentalCarPresenter::toFrontend($c)));
    }

    /** GET /driver/cars/{id} — one car with its blocked days and busy calendar */
    public function showCar(Request $request, int $id)
    {
        $car = $this->fleet->findOwned($request->user(), $id);

        return response()->json(RentalCarPresenter::toFrontend($car) + [
            'blocks' => $car->blocks()->orderBy('start_date')->get(['id', 'start_date', 'end_date', 'reason']),
            'busy'   => RentalAvailability::busyRanges($car),
        ]);
    }

    /** POST /driver/cars — new listings wait for admin verification */
    public function storeCar(Request $request)
    {
        $validated = $request->validate(RentalCarForm::rules(true));
        $car = $this->fleet->create($request->user(), $validated);

        return response()->json(RentalCarPresenter::toFrontend($car), 201);
    }

    /** PATCH /driver/cars/{id} */
    public function updateCar(Request $request, $id)
    {
        // Ownership is checked before validation (404 wins over 422), as before.
        $car = $this->fleet->findOwned($request->user(), $id);
        $validated = $request->validate(RentalCarForm::rules(false));

        return response()->json(RentalCarPresenter::toFrontend($this->fleet->update($car, $validated)));
    }

    /** DELETE /driver/cars/{id} */
    public function destroyCar(Request $request, $id)
    {
        $this->fleet->delete($this->fleet->findOwned($request->user(), $id));

        return response()->json(null, 204);
    }

    /** POST /driver/cars/{id}/photos (multipart: photo) */
    public function uploadPhoto(Request $request, int $id)
    {
        $car = $this->fleet->findOwned($request->user(), $id);
        $request->validate(['photo' => ['required', 'image', 'max:8192']]);

        return response()->json(RentalCarPresenter::toFrontend($this->fleet->addPhoto($car, $request->file('photo'))));
    }

    /** DELETE /driver/cars/{id}/photos/{index} */
    public function deletePhoto(Request $request, int $id, int $index)
    {
        $car = $this->fleet->findOwned($request->user(), $id);

        return response()->json(RentalCarPresenter::toFrontend($this->fleet->removePhoto($car, $index)));
    }

    /** POST /driver/cars/{id}/photos/{index}/cover */
    public function coverPhoto(Request $request, int $id, int $index)
    {
        $car = $this->fleet->findOwned($request->user(), $id);

        return response()->json(RentalCarPresenter::toFrontend($this->fleet->makeCover($car, $index)));
    }

    /** POST /driver/cars/{id}/documents (multipart: type, file) — registration card or insurance */
    public function uploadDocument(Request $request, int $id)
    {
        $car = $this->fleet->findOwned($request->user(), $id);
        $data = $request->validate([
            'type' => ['required', Rule::in(CarRental::DOCUMENT_TYPES)],
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
        ]);

        return response()->json(RentalCarPresenter::toFrontend($this->fleet->uploadDocument($car, $data['type'], $request->file('file'))));
    }

    /** GET /driver/cars/{id}/documents/{type} — the owner's own file */
    public function document(Request $request, int $id, string $type)
    {
        $car = $this->fleet->findOwned($request->user(), $id);

        return response()->file(Storage::disk('local')->path($this->fleet->readableDocumentPath($request->user(), $car, $type)));
    }

    /** POST /driver/cars/{id}/blocks {start_date, end_date, reason?} */
    public function addBlock(Request $request, int $id)
    {
        $car = $this->fleet->findOwned($request->user(), $id);
        $data = $request->validate([
            'start_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'end_date'   => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'reason'     => ['nullable', 'string', 'max:120'],
        ]);

        return response()->json($this->fleet->addBlock($car, $data), 201);
    }

    /** DELETE /driver/cars/{id}/blocks/{blockId} */
    public function removeBlock(Request $request, int $id, int $blockId)
    {
        $this->fleet->removeBlock($this->fleet->findOwned($request->user(), $id), $blockId);

        return response()->json(null, 204);
    }
}
