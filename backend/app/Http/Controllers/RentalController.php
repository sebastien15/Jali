<?php

namespace App\Http\Controllers;

use App\Models\CarRental;
use App\Models\RentalBooking;
use App\Modules\Rentals\Application\RentalAvailability;
use App\Modules\Rentals\Application\RentalBookingPresenter;
use App\Modules\Rentals\Application\RentalCarPresenter;
use App\Modules\Rentals\Application\RentalCatalogue;
use App\Modules\Rentals\Application\RentalQuote;
use App\Modules\Rentals\Application\RentalService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Customer side of car rental (stories S24.1, S24.3–S24.6). Requires rent-cars. */
class RentalController extends Controller
{
    public function __construct(private RentalCatalogue $catalogue, private RentalService $rentals)
    {
    }

    /** GET /rentals/cars?start_at&end_at&type&transmission&seats&max_price&city&q&sort */
    public function search(Request $request)
    {
        $filters = $request->validate([
            'start_at'     => ['nullable', 'date', 'required_with:end_at'],
            'end_at'       => ['nullable', 'date', 'required_with:start_at', 'after:start_at'],
            'type'         => ['nullable', Rule::in(CarRental::TYPES)],
            'transmission' => ['nullable', Rule::in(CarRental::TRANSMISSIONS)],
            'seats'        => ['nullable', 'integer', 'min:1', 'max:60'],
            'max_price'    => ['nullable', 'integer', 'min:0'],
            'city'         => ['nullable', 'string', 'max:60'],
            'q'            => ['nullable', 'string', 'max:60'],
            'sort'         => ['nullable', Rule::in(['price', 'rating'])],
        ]);
        [$start, $end] = $this->range($filters);

        return response()->json([
            'data'   => $this->catalogue->search($filters, $start, $end, $request->user()->id),
            'cities' => $this->catalogue->cities(),
        ]);
    }

    /** GET /rentals/cars/{id}?start_at&end_at — detail, calendar and (with dates) the price */
    public function car(Request $request, int $id)
    {
        $filters = $request->validate([
            'start_at'      => ['nullable', 'date', 'required_with:end_at'],
            'end_at'        => ['nullable', 'date', 'required_with:start_at', 'after:start_at'],
            'pickup_method' => ['nullable', Rule::in(['pickup', 'delivery'])],
        ]);
        $car = CarRental::with('owner')->findOrFail($id);
        abort_unless($car->isBookable(), 404, 'This car is not available for rent.');
        [$start, $end] = $this->range($filters);
        $quote = $start ? RentalQuote::quote($car, $start, $end, ($filters['pickup_method'] ?? 'pickup') === 'delivery') : null;
        $data = RentalCarPresenter::forCustomer($car, $quote, true);
        $data['available'] = $start ? RentalAvailability::isFree($car, $start, $end) : null;

        return response()->json($data);
    }

    /** POST /rentals/bookings */
    public function store(Request $request)
    {
        $data = $request->validate([
            'car_id'           => ['required', 'integer', 'exists:car_rentals,id'],
            'start_at'         => ['required', 'date'],
            'end_at'           => ['required', 'date', 'after:start_at'],
            'pickup_method'    => ['required', Rule::in(['pickup', 'delivery'])],
            'delivery_address' => ['required_if:pickup_method,delivery', 'nullable', 'string', 'max:255'],
            'payment_method'   => ['required', Rule::in(['cash', 'momo'])],
            'note'             => ['nullable', 'string', 'max:500'],
            'accept_terms'     => ['accepted'],
            'driver_confirmed' => ['accepted'],
        ], [
            'accept_terms.accepted'     => 'Please accept the rental rules to continue.',
            'driver_confirmed.accepted' => 'Please confirm the driver meets the age and licence requirements.',
        ]);
        $car = CarRental::with('owner')->findOrFail($data['car_id']);
        $booking = $this->rentals->request($request->user(), $car, $data);

        return response()->json(RentalBookingPresenter::for($booking, $request->user(), 'customer'), 201);
    }

    /** GET /rentals/bookings?scope=upcoming|past */
    public function index(Request $request)
    {
        $scope = $request->validate(['scope' => ['nullable', Rule::in(['upcoming', 'past'])]])['scope'] ?? null;
        $user = $request->user();
        $bookings = RentalBooking::with('car', 'owner')->where('customer_id', $user->id)
            ->when($scope === 'upcoming', fn ($q) => $q->whereIn('status', RentalBooking::OPEN))
            ->when($scope === 'past', fn ($q) => $q->whereNotIn('status', RentalBooking::OPEN))
            ->orderByDesc('start_at')->limit(100)->get();

        return response()->json(['data' => $bookings->map(fn ($b) => RentalBookingPresenter::for($b, $user, 'customer'))->values()]);
    }

    /** GET /rentals/bookings/{id} */
    public function show(Request $request, int $id)
    {
        return response()->json(RentalBookingPresenter::for($this->mine($request, $id), $request->user(), 'customer'));
    }

    /** POST /rentals/bookings/{id}/cancel {reason} */
    public function cancel(Request $request, int $id)
    {
        $booking = $this->mine($request, $id);
        $data = $request->validate(['reason' => ['required', Rule::in(RentalService::CUSTOMER_CANCEL_REASONS)]]);

        return response()->json(RentalBookingPresenter::for($this->rentals->cancelByCustomer($booking, $data['reason']), $request->user(), 'customer'));
    }

    /** POST /rentals/bookings/{id}/rate {stars, comment?} */
    public function rate(Request $request, int $id)
    {
        $booking = $this->mine($request, $id);
        $data = $request->validate(['stars' => ['required', 'integer', 'between:1,5'], 'comment' => ['nullable', 'string', 'max:500']]);
        $this->rentals->rate($request->user(), $booking, $data['stars'], $data['comment'] ?? null);

        return response()->json(RentalBookingPresenter::for($booking->fresh(), $request->user(), 'customer'), 201);
    }

    private function mine(Request $request, int $id): RentalBooking
    {
        // Someone else's rental is reported as missing, not forbidden
        return RentalBooking::where('customer_id', $request->user()->id)->findOrFail($id);
    }

    private function range(array $filters): array
    {
        if (empty($filters['start_at'])) {
            return [null, null];
        }

        return [Carbon::parse($filters['start_at'])->utc(), Carbon::parse($filters['end_at'])->utc()];
    }
}
