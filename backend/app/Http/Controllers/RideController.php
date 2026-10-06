<?php

namespace App\Http\Controllers;

use App\Models\Vehicle;
use App\Modules\NearbyRides\Application\NearbyDrivers;
use App\Modules\NearbyRides\Application\RidePresenter;
use App\Modules\NearbyRides\Application\RideQueries;
use App\Modules\NearbyRides\Application\RideService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Rider side of on-demand rides.
 * Transport adapter for NearbyRides (runbook M03-Rides): validation + HTTP shape only.
 */
class RideController extends Controller
{
    public function __construct(
        private readonly RideService $rides,
        private readonly RideQueries $queries,
    ) {
    }

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
    public function store(Request $request)
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
            ? $this->rides->requestBroadcast($request->user(), $pickup, $dropoff, $payment,
                $validated['vehicle_class'] ?? null, isset($validated['max_fare']) ? (int) $validated['max_fare'] : null)
            : $this->rides->request($request->user(), (int) $validated['driver_id'], $pickup, $dropoff, $payment);

        return response()->json(RidePresenter::present($ride, $request->user()), 201);
    }

    /** POST /rides/estimate — price range and nearest ETA per vehicle class (story S3.6) */
    public function estimate(Request $request)
    {
        $validated = $request->validate($this->pointRules());
        [$pickup, $dropoff] = $this->points($validated);

        return response()->json($this->rides->estimate($request->user(), $pickup, $dropoff));
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
        return response()->json($this->queries->riderPage($request->user()));
    }

    /** GET /rides/active — my current ride as rider or driver, or null (polled during a trip) */
    public function active(Request $request)
    {
        $user = $request->user();
        $ride = $this->queries->activeRide($user);

        // Literal JSON null (response()->json(null) would send "{}")
        return $ride
            ? response()->json(RidePresenter::present($ride, $user))
            : JsonResponse::fromJsonString('null');
    }

    /** GET /rides/{id} — rider or assigned driver only */
    public function show(Request $request, int $id)
    {
        return response()->json(RidePresenter::present($this->queries->shownRide($request->user(), $id), $request->user()));
    }

    /** POST /rides/{id}/cancel { reason } */
    public function cancel(Request $request, int $id)
    {
        $validated = $request->validate(['reason' => 'required|string|max:50']);
        $ride = $this->rides->cancel($this->queries->participantRide($request->user(), $id), $request->user(), $validated['reason']);

        return response()->json(RidePresenter::present($ride, $request->user()));
    }

    /** POST /rides/{id}/rate { stars, tags?, comment? } — rider rates driver or driver rates rider */
    public function rate(Request $request, int $id)
    {
        $validated = $request->validate([
            'stars'   => 'required|integer|min:1|max:5',
            'tags'    => 'sometimes|array|max:6',
            'tags.*'  => 'string|max:40',
            'comment' => 'sometimes|nullable|string|max:500',
        ]);
        $this->rides->rate($this->queries->participantRide($request->user(), $id), $request->user(), $validated['stars'], $validated['tags'] ?? [], $validated['comment'] ?? null);

        return response()->json(['message' => 'Thanks for rating'], 201);
    }
}
