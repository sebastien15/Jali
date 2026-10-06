<?php

namespace App\Http\Controllers;

use App\Modules\Rentals\Application\OwnerFleet;
use App\Modules\Rentals\Application\RentalCarPresenter;
use App\Modules\Rentals\Application\RentalCatalogue;
use Illuminate\Http\Request;

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
     * Public catalog — admin-seeded and driver-listed active cars.
     */
    public function index(Request $request)
    {
        return response()->json($this->catalogue->available($request->filled('type') ? $request->type : null));
    }

    /**
     * GET /driver/cars
     * Driver's own fleet.
     */
    public function driverCars(Request $request)
    {
        $cars = $this->fleet->carsOf($request->user());

        return response()->json($cars->map(fn($c) => RentalCarPresenter::toFrontend($c)));
    }

    /**
     * POST /driver/cars
     */
    public function storeCar(Request $request)
    {
        $validated = $request->validate([
            'name'      => 'required|string',
            'type'      => 'required|in:Sedan,SUV,Minivan,Pickup',
            'plate'     => 'required|string',
            'seats'     => 'required|integer|min:1',
            'priceDay'  => 'required|integer|min:0',
            'caution'   => 'nullable|integer|min:0',
            'amenities' => 'nullable|array',
            'photos'    => 'nullable|array',
        ]);

        $car = $this->fleet->create($request->user(), $validated);

        return response()->json(RentalCarPresenter::toFrontend($car), 201);
    }

    /**
     * PATCH /driver/cars/{id}
     */
    public function updateCar(Request $request, $id)
    {
        // Ownership is checked before validation (404 wins over 422), as before.
        $car = $this->fleet->findOwned($request->user(), $id);

        $validated = $request->validate([
            'name'      => 'sometimes|string',
            'type'      => 'sometimes|in:Sedan,SUV,Minivan,Pickup',
            'plate'     => 'sometimes|string',
            'seats'     => 'sometimes|integer|min:1',
            'priceDay'  => 'sometimes|integer|min:0',
            'caution'   => 'nullable|integer|min:0',
            'status'    => 'sometimes|in:available,rented,maintenance',
            'amenities' => 'nullable|array',
            'photos'    => 'nullable|array',
            'notes'     => 'nullable|string',
        ]);

        return response()->json(RentalCarPresenter::toFrontend($this->fleet->update($car, $validated)));
    }

    /**
     * DELETE /driver/cars/{id}
     */
    public function destroyCar(Request $request, $id)
    {
        $this->fleet->delete($this->fleet->findOwned($request->user(), $id));

        return response()->json(null, 204);
    }
}
