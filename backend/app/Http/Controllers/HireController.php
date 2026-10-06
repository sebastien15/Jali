<?php

namespace App\Http\Controllers;

use App\Models\DriverHire;
use App\Modules\DriverHire\Application\HireBookingWindow;
use App\Modules\DriverHire\Application\HireDriverSearch;
use App\Modules\DriverHire\Application\HirePresenter;
use App\Modules\DriverHire\Application\HireQueries;
use App\Modules\DriverHire\Application\HireService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Customer side of Hire a Driver (stories S6.3, S6.4): find a free driver for
 * my own car, book, follow, cancel and rate. Requires request-rides.
 * Transport adapter for DriverHire (runbook M03-Hire): validation + HTTP shape only.
 */
class HireController extends Controller
{
    public function __construct(
        private readonly HireService $hires,
        private readonly HireQueries $queries,
        private readonly HireDriverSearch $search,
    ) {
    }

    /** GET /driver-hire/available — verified drivers free for the window who drive my transmission */
    public function available(Request $request)
    {
        $data = $this->validateBooking($request, false);
        $start = HireBookingWindow::start($data);

        return response()->json(['drivers' => $this->search->available($request->user(), $data, $start)]);
    }

    /** POST /driver-hire — book one driver (status requested) */
    public function store(Request $request)
    {
        $data = $this->validateBooking($request, true);
        $start = HireBookingWindow::start($data);
        $driver = $this->search->bookableDriver($request->user(), $data);
        if (!$driver) {
            throw ValidationException::withMessages(['driver_id' => 'This driver is not available for hire.']);
        }

        $hire = $this->hires->request($request->user(), $driver, $data, $start);

        return response()->json(HirePresenter::present($hire, $request->user()), 201);
    }

    /** GET /driver-hire — my bookings as a customer, newest first */
    public function index(Request $request)
    {
        return response()->json($this->queries->customerPage($request->user()));
    }

    /** GET /driver-hire/{id} — customer or driver of this hire only */
    public function show(Request $request, int $id)
    {
        $hire = $this->queries->participantHire($request->user(), $id);
        $this->hires->expireIfLate($hire);

        return response()->json(HirePresenter::present($hire, $request->user()));
    }

    /** POST /driver-hire/{id}/cancel {reason} */
    public function cancel(Request $request, int $id)
    {
        $user = $request->user();
        $hire = $this->queries->participantHire($user, $id);
        $validated = $request->validate(['reason' => ['required', Rule::in($this->hires->cancelReasons($hire, $user))]]);

        return response()->json(HirePresenter::present($this->hires->cancel($hire, $user, $validated['reason']), $user));
    }

    /** POST /driver-hire/{id}/rate {stars, tags?, comment?} */
    public function rate(Request $request, int $id)
    {
        $user = $request->user();
        $hire = $this->queries->participantHire($user, $id);
        $validated = $request->validate([
            'stars'   => 'required|integer|between:1,5',
            'tags'    => 'sometimes|array|max:6',
            'tags.*'  => 'string|max:40',
            'comment' => 'sometimes|nullable|string|max:500',
        ]);
        $this->hires->rate($hire, $user, $validated['stars'], $validated['tags'] ?? [], $validated['comment'] ?? null);

        return response()->json(['message' => 'Thanks for your rating.'], 201);
    }

    private function validateBooking(Request $request, bool $booking): array
    {
        $maxDays = HireBookingWindow::maxDays();
        $rules = [
            'start_at'       => 'required|date',
            'duration_type'  => 'required|in:hours,days',
            'duration_value' => ['required', 'integer', 'min:1', $request->input('duration_type') === 'days' ? "max:$maxDays" : 'max:16'],
            'trip_type'      => ['required', Rule::in(DriverHire::TRIP_TYPES)],
            'transmission'   => ['required', Rule::in(DriverHire::TRANSMISSIONS)],
        ];
        if ($booking) {
            $rules += [
                'driver_id'       => 'required|integer',
                'pickup'          => 'required|array',
                'pickup.lat'      => 'required|numeric|between:-90,90',
                'pickup.lng'      => 'required|numeric|between:-180,180',
                'pickup.address'  => 'sometimes|nullable|string|max:255',
                'car_description' => 'sometimes|nullable|string|max:200',
                'notes'           => 'sometimes|nullable|string|max:500',
                'payment_method'  => 'sometimes|in:cash,momo',
                'accept_terms'    => 'accepted',
            ];
        }

        return $request->validate($rules, [
            'accept_terms.accepted' => 'Please accept the hire terms (fuel, damage and meals).',
        ]);
    }
}
