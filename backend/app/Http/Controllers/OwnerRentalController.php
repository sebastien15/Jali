<?php

namespace App\Http\Controllers;

use App\Models\CarRental;
use App\Models\RentalBooking;
use App\Modules\Rentals\Application\RentalBookingPresenter;
use App\Modules\Rentals\Application\RentalService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Owner side of car rental: requests, handover, return and income (stories S24.4–S24.7). Requires offer-rentals. */
class OwnerRentalController extends Controller
{
    public function __construct(private RentalService $rentals)
    {
    }

    /** GET /driver/rentals?status=requested|upcoming|active|past&car_id */
    public function index(Request $request)
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['requested', 'upcoming', 'active', 'past'])],
            'car_id' => ['nullable', 'integer'],
        ]);
        $owner = $request->user();
        $bookings = RentalBooking::with('car', 'customer')->where('owner_id', $owner->id)
            ->when($filters['car_id'] ?? null, fn ($q, $car) => $q->where('car_rental_id', $car))
            ->when(($filters['status'] ?? null) === 'requested', fn ($q) => $q->where('status', RentalBooking::REQUESTED))
            ->when(($filters['status'] ?? null) === 'upcoming', fn ($q) => $q->where('status', RentalBooking::ACCEPTED))
            ->when(($filters['status'] ?? null) === 'active', fn ($q) => $q->where('status', RentalBooking::ACTIVE))
            ->when(($filters['status'] ?? null) === 'past', fn ($q) => $q->whereNotIn('status', RentalBooking::OPEN))
            ->orderBy(($filters['status'] ?? null) === 'past' ? 'end_at' : 'start_at', ($filters['status'] ?? null) === 'past' ? 'desc' : 'asc')
            ->limit(100)->get();

        return response()->json(['data' => $bookings->map(fn ($b) => RentalBookingPresenter::for($b, $owner, 'owner'))->values()]);
    }

    /** GET /driver/rentals/summary — dashboard counters and income (S24.7) */
    public function summary(Request $request)
    {
        $owner = $request->user();
        $base = RentalBooking::where('owner_id', $owner->id);
        $monthStart = now('Africa/Kigali')->startOfMonth()->utc();
        $completed = (clone $base)->where('status', RentalBooking::COMPLETED);
        $cars = CarRental::where('user_id', $owner->id)->get();

        return response()->json([
            'requests'           => (clone $base)->where('status', RentalBooking::REQUESTED)->where('expires_at', '>', now())->count(),
            'upcoming'           => (clone $base)->where('status', RentalBooking::ACCEPTED)->count(),
            'active'             => (clone $base)->where('status', RentalBooking::ACTIVE)->count(),
            'income_this_month'  => (int) (clone $completed)->where('returned_at', '>=', $monthStart)->sum('final_total'),
            'income_total'       => (int) (clone $completed)->sum('final_total'),
            'completed_rentals'  => (clone $completed)->count(),
            'cars'               => $cars->count(),
            'cars_pending'       => $cars->where('verification_status', CarRental::PENDING)->count(),
            'next_handover'      => optional((clone $base)->where('status', RentalBooking::ACCEPTED)->orderBy('start_at')->first(), fn ($b) => [
                'id' => $b->id, 'start_at' => $b->start_at->toIso8601String(), 'car' => $b->car?->name,
            ]),
            'per_car'            => $cars->map(fn (CarRental $car) => [
                'car_id' => $car->id,
                'name'   => $car->name,
                'income' => (int) RentalBooking::where('car_rental_id', $car->id)->where('status', RentalBooking::COMPLETED)->sum('final_total'),
                'trips'  => (int) $car->trips_count,
            ])->values(),
        ]);
    }

    /** GET /driver/rentals/{id} */
    public function show(Request $request, int $id)
    {
        return response()->json(RentalBookingPresenter::for($this->mine($request, $id), $request->user(), 'owner'));
    }

    /** POST /driver/rentals/{id}/accept */
    public function accept(Request $request, int $id)
    {
        $booking = $this->rentals->accept($request->user(), $this->mine($request, $id));

        return response()->json(RentalBookingPresenter::for($booking, $request->user(), 'owner'));
    }

    /** POST /driver/rentals/{id}/decline {reason?} */
    public function decline(Request $request, int $id)
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:300']]);
        $booking = $this->rentals->decline($request->user(), $this->mine($request, $id), $data['reason'] ?? null);

        return response()->json(RentalBookingPresenter::for($booking, $request->user(), 'owner'));
    }

    /** POST /driver/rentals/{id}/cancel {reason} — only accepted rentals, before handover */
    public function cancel(Request $request, int $id)
    {
        $data = $request->validate(['reason' => ['required', Rule::in(RentalService::OWNER_CANCEL_REASONS)]]);
        $booking = $this->rentals->cancelByOwner($this->mine($request, $id), $data['reason']);

        return response()->json(RentalBookingPresenter::for($booking, $request->user(), 'owner'));
    }

    /** POST /driver/rentals/{id}/handover (multipart: odometer_km, fuel_level, notes?, photos[]) */
    public function handover(Request $request, int $id)
    {
        $booking = $this->mine($request, $id);
        $data = $request->validate($this->recordRules());
        $booking = $this->rentals->handover($booking, $data, (array) $request->file('photos', []));

        return response()->json(RentalBookingPresenter::for($booking, $request->user(), 'owner'));
    }

    /** POST /driver/rentals/{id}/return (multipart: odometer_km, fuel_level, notes?, photos[], other_charges[]) */
    public function returnCar(Request $request, int $id)
    {
        $booking = $this->mine($request, $id);
        $data = $request->validate($this->recordRules() + [
            'other_charges'          => ['nullable', 'array', 'max:5'],
            'other_charges.*.label'  => ['required', 'string', 'max:80'],
            'other_charges.*.amount' => ['required', 'integer', 'min:1', 'max:10000000'],
        ]);
        $booking = $this->rentals->returnCar($booking, $data, (array) $request->file('photos', []));

        return response()->json(RentalBookingPresenter::for($booking, $request->user(), 'owner'));
    }

    /** POST /driver/rentals/{id}/rate {stars, comment?} — the owner rates the customer */
    public function rate(Request $request, int $id)
    {
        $booking = $this->mine($request, $id);
        $data = $request->validate(['stars' => ['required', 'integer', 'between:1,5'], 'comment' => ['nullable', 'string', 'max:500']]);
        $this->rentals->rate($request->user(), $booking, $data['stars'], $data['comment'] ?? null);

        return response()->json(RentalBookingPresenter::for($booking->fresh(), $request->user(), 'owner'), 201);
    }

    private function recordRules(): array
    {
        return [
            'odometer_km' => ['required', 'integer', 'min:0', 'max:2000000'],
            'fuel_level'  => ['required', 'integer', 'between:0,8'],
            'notes'       => ['nullable', 'string', 'max:1000'],
            'photos'      => ['nullable', 'array', 'max:8'],
            'photos.*'    => ['image', 'max:8192'],
        ];
    }

    private function mine(Request $request, int $id): RentalBooking
    {
        return RentalBooking::where('owner_id', $request->user()->id)->findOrFail($id);
    }
}
