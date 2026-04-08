<?php

namespace App\Http\Controllers;

use App\Models\CarRental;
use Illuminate\Http\Request;

class CarRentalController extends Controller
{
    /**
     * GET /car-rentals
     * Public catalog — admin-seeded and driver-listed active cars.
     */
    public function index(Request $request)
    {
        $query = CarRental::query()->where('active', true);

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        return response()->json($query->orderBy('price')->get());
    }

    /**
     * GET /driver/cars
     * Driver's own fleet.
     */
    public function driverCars(Request $request)
    {
        $cars = CarRental::where('user_id', $request->auth_user->id)->get();

        return response()->json($cars->map(fn($c) => $this->toFrontend($c)));
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

        $car = CarRental::create([
            'user_id'  => $request->auth_user->id,
            'name'     => $validated['name'],
            'type'     => $validated['type'],
            'plate'    => $validated['plate'],
            'seats'    => $validated['seats'],
            'price'    => $validated['priceDay'],   // frontend sends priceDay → stored as price
            'caution'  => $validated['caution'] ?? 0,
            'amenities'=> $validated['amenities'] ?? [],
            'photos'   => $validated['photos'] ?? [],
            'rating'   => 0,
            'active'   => true,
        ]);

        return response()->json($this->toFrontend($car), 201);
    }

    /**
     * PATCH /driver/cars/{id}
     */
    public function updateCar(Request $request, $id)
    {
        $car = CarRental::where('id', $id)
            ->where('user_id', $request->auth_user->id)
            ->firstOrFail();

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

        if (isset($validated['priceDay'])) {
            $validated['price'] = $validated['priceDay'];
            unset($validated['priceDay']);
        }

        $car->update($validated);

        return response()->json($this->toFrontend($car->fresh()));
    }

    /**
     * DELETE /driver/cars/{id}
     */
    public function destroyCar(Request $request, $id)
    {
        $car = CarRental::where('id', $id)
            ->where('user_id', $request->auth_user->id)
            ->firstOrFail();

        $car->delete();

        return response()->json(null, 204);
    }

    /**
     * Map DB column `price` → frontend field `priceDay`.
     */
    private function toFrontend(CarRental $car): array
    {
        $data             = $car->toArray();
        $data['priceDay'] = $car->price;
        return $data;
    }
}
