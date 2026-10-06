<?php

namespace App\Http\Controllers;

use App\Models\Ride;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\Rides\NearbyDrivers;
use App\Services\Rides\RidePresenter;
use App\Services\Rides\RideService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Rider side of on-demand rides.
 */
class RideController extends Controller
{
    /** GET /rides/nearby — story S3.2 */
    public function nearby(Request $request, NearbyDrivers $nearby)
    {
        $validated = $request->validate([
            'lat'      => 'required|numeric|between:-90,90',
            'lng'      => 'required|numeric|between:-180,180',
            'dest_lat' => 'required|numeric|between:-90,90',
            'dest_lng' => 'required|numeric|between:-180,180',
            'class'    => ['sometimes', 'nullable', Rule::in(Vehicle::CLASSES)],
        ]);

        return response()->json($nearby->search(
            (float) $validated['lat'], (float) $validated['lng'],
            (float) $validated['dest_lat'], (float) $validated['dest_lng'],
            $validated['class'] ?? null,
            $request->user()->id,
        ));
    }

    /** POST /rides — request a specific driver (pick, S3.4) or all nearby under a max price (broadcast, S3.5) */
    public function store(Request $request, RideService $rides)
    {
        $validated = $request->validate($this->pointRules() + [
            'mode'           => 'required|in:pick,broadcast',
            'driver_id'      => 'required_if:mode,pick|integer',
            'vehicle_class'  => ['sometimes', 'nullable', Rule::in(Vehicle::CLASSES)],
            'max_fare'       => 'sometimes|nullable|integer|min:500|max:1000000',
            'payment_method' => 'sometimes|in:cash,momo',
        ]);
        [$pickup, $dropoff] = $this->points($validated);
        $payment = $validated['payment_method'] ?? 'cash';

        $ride = $validated['mode'] === 'broadcast'
            ? $rides->requestBroadcast($request->user(), $pickup, $dropoff, $payment,
                $validated['vehicle_class'] ?? null, isset($validated['max_fare']) ? (int) $validated['max_fare'] : null)
            : $rides->request($request->user(), (int) $validated['driver_id'], $pickup, $dropoff, $payment);

        return response()->json(RidePresenter::present($ride, $request->user()), 201);
    }

    /** POST /rides/estimate — price range and nearest ETA per vehicle class (story S3.6) */
    public function estimate(Request $request, RideService $rides)
    {
        $validated = $request->validate($this->pointRules());
        [$pickup, $dropoff] = $this->points($validated);

        return response()->json($rides->estimate($request->user(), $pickup, $dropoff));
    }

    private function pointRules(): array
    {
        return [
            'pickup'          => 'required|array',
            'pickup.lat'      => 'required|numeric|between:-90,90',
            'pickup.lng'      => 'required|numeric|between:-180,180',
            'pickup.address'  => 'sometimes|nullable|string|max:255',
            'dropoff'         => 'required|array',
            'dropoff.lat'     => 'required|numeric|between:-90,90',
            'dropoff.lng'     => 'required|numeric|between:-180,180',
            'dropoff.address' => 'sometimes|nullable|string|max:255',
        ];
    }

    private function points(array $v): array
    {
        return [
            ['lat' => (float) $v['pickup']['lat'], 'lng' => (float) $v['pickup']['lng'], 'address' => $v['pickup']['address'] ?? null],
            ['lat' => (float) $v['dropoff']['lat'], 'lng' => (float) $v['dropoff']['lng'], 'address' => $v['dropoff']['address'] ?? null],
        ];
    }

    /** GET /rides — my rides as a rider, newest first (story S4.6) */
    public function index(Request $request)
    {
        $user = $request->user();
        $page = Ride::where('rider_id', $user->id)->orderByDesc('id')->paginate(20);

        return response()->json([
            'data'      => collect($page->items())->map(fn (Ride $r) => RidePresenter::present($r, $user))->values(),
            'next_page' => $page->hasMorePages() ? $page->currentPage() + 1 : null,
        ]);
    }

    /** GET /rides/active — my current ride as rider or driver, or null (polled during a trip) */
    public function active(Request $request, RideService $rides)
    {
        $user = $request->user();
        $ride = Ride::whereIn('status', Ride::ACTIVE)
            ->where(fn ($q) => $q->where('rider_id', $user->id)->orWhere(fn ($q) => $q->where('driver_id', $user->id)->whereIn('status', Ride::ONGOING)))
            ->orderByDesc('id')->first();

        if ($ride && $this->expireIfLate($ride, $rides)) {
            $ride = $ride->fresh();
        }

        // Literal JSON null (response()->json(null) would send "{}")
        return $ride
            ? response()->json(RidePresenter::present($ride, $user))
            : \Illuminate\Http\JsonResponse::fromJsonString('null');
    }

    /** GET /rides/{id} — rider or assigned driver only */
    public function show(Request $request, RideService $rides, int $id)
    {
        $ride = $this->mine($request->user(), $id);
        if ($this->expireIfLate($ride, $rides)) {
            $ride = $ride->fresh();
        }

        return response()->json(RidePresenter::present($ride, $request->user()));
    }

    /** POST /rides/{id}/cancel { reason } */
    public function cancel(Request $request, RideService $rides, int $id)
    {
        $validated = $request->validate(['reason' => 'required|string|max:50']);
        $ride = $rides->cancel($this->mine($request->user(), $id), $request->user(), $validated['reason']);

        return response()->json(RidePresenter::present($ride, $request->user()));
    }

    /** POST /rides/{id}/rate { stars, tags?, comment? } — rider rates driver or driver rates rider */
    public function rate(Request $request, RideService $rides, int $id)
    {
        $validated = $request->validate([
            'stars'   => 'required|integer|min:1|max:5',
            'tags'    => 'sometimes|array|max:6',
            'tags.*'  => 'string|max:40',
            'comment' => 'sometimes|nullable|string|max:500',
        ]);
        $rides->rate($this->mine($request->user(), $id), $request->user(), $validated['stars'], $validated['tags'] ?? [], $validated['comment'] ?? null);

        return response()->json(['message' => 'Thanks for rating'], 201);
    }

    private function mine(User $user, int $id): Ride
    {
        $ride = Ride::findOrFail($id);
        abort_unless($ride->involves($user), 404);

        return $ride;
    }

    private function expireIfLate(Ride $ride, RideService $rides): bool
    {
        return $ride->status === Ride::REQUESTED && $ride->expires_at?->isPast() && $rides->expire($ride);
    }
}
