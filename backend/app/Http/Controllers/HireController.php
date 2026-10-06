<?php

namespace App\Http\Controllers;

use App\Models\DriverHire;
use App\Models\DriverHireSetting;
use App\Models\DriverProfile;
use App\Models\User;
use App\Services\Hire\HireAvailability;
use App\Services\Hire\HirePresenter;
use App\Services\Hire\HireQuote;
use App\Services\Hire\HireService;
use App\Services\Rides\NearbyDrivers;
use App\Modules\Pricing\Application\RideSettings;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Customer side of Hire a Driver (stories S6.3, S6.4): find a free driver for
 * my own car, book, follow, cancel and rate. Requires request-rides.
 */
class HireController extends Controller
{
    private const MAX_RESULTS = 50;

    /** GET /driver-hire/available — verified drivers free for the window who drive my transmission */
    public function available(Request $request)
    {
        $data = $this->validateBooking($request, false);
        $start = $this->startAt($data);

        $settings = DriverHireSetting::with('user.driverProfile', 'user.role')
            ->where('is_active', true)
            ->whereNot('user_id', $request->user()->id)
            ->whereHas('user.driverProfile', fn ($q) => $q->where('verification_status', DriverProfile::STATUS_VERIFIED))
            ->get()
            ->filter(fn (DriverHireSetting $s) => $s->user->hasPermission('offer-driver-hire')
                && in_array($data['transmission'], $s->user->driverProfile->transmissions ?? [], true));

        $drivers = $settings->map(function (DriverHireSetting $s) use ($data, $start) {
            $end = HireQuote::endAt($start, $data['duration_type'], (int) $data['duration_value'], $s->daily_hours);
            if (!HireAvailability::isFree($s->user_id, $start, $end)) {
                return null;
            }
            $profile = $s->user->driverProfile;
            $quote = HireQuote::quote($s->snapshot(), $data['duration_type'], (int) $data['duration_value'], $data['trip_type']);

            return [
                'driver_id'          => $s->user_id,
                'name'               => NearbyDrivers::displayName($s->user->name),
                'photo'              => preg_match('#^https?://#', (string) $s->user->profile_image_url) ? $s->user->profile_image_url : null,
                'rating'             => (float) $profile->rating_avg,
                'rating_count'       => (int) $profile->rating_count,
                'trips_count'        => (int) $profile->trips_count,
                'years_experience'   => $profile->years_experience,
                'languages'          => $profile->languages ?? [],
                'transmissions'      => $profile->transmissions ?? [],
                'licence_categories' => $profile->licence_categories ?? [],
                'rates'              => $s->snapshot(),
                'end_at'             => $end->toIso8601String(),
                'quote'              => $quote,
            ];
        })->filter()
            ->sortBy([['rating', 'desc'], fn ($a, $b) => $a['quote']['total'] <=> $b['quote']['total']])
            ->take(self::MAX_RESULTS)->values();

        return response()->json(['drivers' => $drivers]);
    }

    /** POST /driver-hire — book one driver (status requested) */
    public function store(Request $request, HireService $hires)
    {
        $data = $this->validateBooking($request, true);
        $start = $this->startAt($data);
        $driver = User::with('driverProfile', 'hireSettings')->find($data['driver_id']);

        $bookable = $driver && $driver->id !== $request->user()->id && $driver->hireSettings?->is_active
            && $driver->driverProfile?->isVerified() && $driver->hasPermission('offer-driver-hire')
            && in_array($data['transmission'], $driver->driverProfile->transmissions ?? [], true);
        if (!$bookable) {
            throw ValidationException::withMessages(['driver_id' => 'This driver is not available for hire.']);
        }

        $hire = $hires->request($request->user(), $driver, $data, $start);

        return response()->json(HirePresenter::present($hire, $request->user()), 201);
    }

    /** GET /driver-hire — my bookings as a customer, newest first */
    public function index(Request $request, HireService $hires)
    {
        $user = $request->user();
        $page = DriverHire::where('customer_id', $user->id)->orderByDesc('id')->paginate(20);
        collect($page->items())->each(fn (DriverHire $h) => $hires->expireIfLate($h));

        return response()->json([
            'data'      => collect($page->items())->map(fn (DriverHire $h) => HirePresenter::present($h, $user))->values(),
            'next_page' => $page->hasMorePages() ? $page->currentPage() + 1 : null,
        ]);
    }

    /** GET /driver-hire/{id} — customer or driver of this hire only */
    public function show(Request $request, HireService $hires, int $id)
    {
        $hire = $this->mine($request->user(), $id);
        $hires->expireIfLate($hire);

        return response()->json(HirePresenter::present($hire, $request->user()));
    }

    /** POST /driver-hire/{id}/cancel {reason} */
    public function cancel(Request $request, HireService $hires, int $id)
    {
        $user = $request->user();
        $hire = $this->mine($user, $id);
        $reasons = $hire->customer_id === $user->id ? HireService::CUSTOMER_CANCEL_REASONS : HireService::DRIVER_CANCEL_REASONS;
        $validated = $request->validate(['reason' => ['required', Rule::in($reasons)]]);

        return response()->json(HirePresenter::present($hires->cancel($hire, $user, $validated['reason']), $user));
    }

    /** POST /driver-hire/{id}/rate {stars, tags?, comment?} */
    public function rate(Request $request, HireService $hires, int $id)
    {
        $user = $request->user();
        $hire = $this->mine($user, $id);
        $validated = $request->validate([
            'stars'   => 'required|integer|between:1,5',
            'tags'    => 'sometimes|array|max:6',
            'tags.*'  => 'string|max:40',
            'comment' => 'sometimes|nullable|string|max:500',
        ]);
        $hires->rate($hire, $user, $validated['stars'], $validated['tags'] ?? [], $validated['comment'] ?? null);

        return response()->json(['message' => 'Thanks for your rating.'], 201);
    }

    private function mine(User $user, int $id): DriverHire
    {
        $hire = DriverHire::find($id);
        abort_unless($hire && $hire->involves($user), 404, 'Hire not found.');

        return $hire;
    }

    private function validateBooking(Request $request, bool $booking): array
    {
        $maxDays = (int) RideSettings::hire()['max_days'];
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

    private function startAt(array $data): Carbon
    {
        $start = Carbon::parse($data['start_at'])->utc()->seconds(0);
        if ($start->lt(now()->addMinutes(30))) {
            throw ValidationException::withMessages(['start_at' => 'Choose a start time at least 30 minutes from now.']);
        }
        if ($start->gt(now()->addDays(90))) {
            throw ValidationException::withMessages(['start_at' => 'You can book up to 90 days ahead.']);
        }

        return $start;
    }
}
