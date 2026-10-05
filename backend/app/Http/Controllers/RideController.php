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

    /** POST /rides — request a specific driver (story S3.4) */
    public function store(Request $request, RideService $rides)
    {
        $validated = $request->validate([
            'mode'             => 'required|in:pick',
            'driver_id'        => 'required|integer',
            'pickup'           => 'required|array',
            'pickup.lat'       => 'required|numeric|between:-90,90',
            'pickup.lng'       => 'required|numeric|between:-180,180',
            'pickup.address'   => 'sometimes|nullable|string|max:255',
            'dropoff'          => 'required|array',
            'dropoff.lat'      => 'required|numeric|between:-90,90',
            'dropoff.lng'      => 'required|numeric|between:-180,180',
            'dropoff.address'  => 'sometimes|nullable|string|max:255',
            'payment_method'   => 'sometimes|in:cash,momo',
        ]);

        $ride = $rides->request(
            $request->user(),
            (int) $validated['driver_id'],
            ['lat' => (float) $validated['pickup']['lat'], 'lng' => (float) $validated['pickup']['lng'], 'address' => $validated['pickup']['address'] ?? null],
            ['lat' => (float) $validated['dropoff']['lat'], 'lng' => (float) $validated['dropoff']['lng'], 'address' => $validated['dropoff']['address'] ?? null],
            $validated['payment_method'] ?? 'cash',
        );

        return response()->json(RidePresenter::present($ride, $request->user()), 201);
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
