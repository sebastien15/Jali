<?php

namespace App\Http\Controllers;

use App\Models\Ride;
use App\Models\RideDispatch;
use App\Services\Rides\RidePresenter;
use App\Services\Rides\RideService;
use App\Modules\Locations\Application\PlaceSearch;
use Illuminate\Http\Request;

/**
 * Driver side of on-demand rides (stories S5.2, S4.1, S4.2, S4.4). Requires offer-rides.
 */
class DriverRideController extends Controller
{
    /** GET /driver/ride-requests — what this driver sees before accepting (no exact pickup, no phone) */
    public function requests(Request $request, RideService $rides)
    {
        $driver = $request->user();
        $dispatches = RideDispatch::with('ride.rider')
            ->where('driver_id', $driver->id)->where('status', 'sent')
            ->whereHas('ride', fn ($q) => $q->where('status', Ride::REQUESTED))
            ->orderBy('id')->get();

        $cards = [];
        foreach ($dispatches as $d) {
            $ride = $d->ride;
            if ($ride->expires_at?->isPast()) {
                $rides->expire($ride);
                continue;
            }
            // Broadcast: each driver sees their own price (S3.5)
            $driverFare = $d->fare['driver_fare'] ?? $ride->driver_fare;
            $commission = (int) round($driverFare * $ride->commission_pct / 100);
            $cards[] = [
                'ride_id'        => $ride->id,
                'pickup_area'    => self::area($ride->pickup_address),
                'dropoff_area'   => self::area($ride->dropoff_address),
                'trip_km'        => $ride->est_distance_km,
                'pickup_km'      => $d->fare['pickup_km'] ?? $ride->pickup_km,
                'earnings'       => $driverFare - $commission,
                'broadcast'      => $ride->mode === 'broadcast',
                'rider_rating'   => RidePresenter::riderRating($ride->rider_id),
                'payment_method' => $ride->payment_method ?? 'cash',
                'expires_at'     => $ride->expires_at?->toIso8601String(),
            ];
        }

        return response()->json($cards);
    }

    public function accept(Request $request, RideService $rides, int $id)
    {
        return $this->respond($request, $rides->accept($this->offered($request, $id), $request->user()));
    }

    public function decline(Request $request, RideService $rides, int $id)
    {
        return $this->respond($request, $rides->decline($this->offered($request, $id), $request->user()));
    }

    public function arrive(Request $request, RideService $rides, int $id)
    {
        return $this->respond($request, $rides->arrive($this->assigned($request, $id), $request->user()));
    }

    public function start(Request $request, RideService $rides, int $id)
    {
        $validated = $request->validate(['pin' => ['required', 'string', 'regex:/^[0-9]{4}$/']]);

        return $this->respond($request, $rides->start($this->assigned($request, $id), $request->user(), $validated['pin']));
    }

    public function complete(Request $request, RideService $rides, int $id)
    {
        $validated = $request->validate(['payment_method' => 'required|in:cash,momo']);

        return $this->respond($request, $rides->complete($this->assigned($request, $id), $request->user(), $validated['payment_method']));
    }

    /** Assigned to me, or a broadcast I was offered (S3.5) */
    private function offered(Request $request, int $id): Ride
    {
        $ride = Ride::findOrFail($id);
        $mine = $ride->driver_id === $request->user()->id;
        $offered = $ride->mode === 'broadcast' && RideDispatch::where(['ride_id' => $ride->id, 'driver_id' => $request->user()->id])->exists();
        abort_unless($mine || $offered, 404);

        return $ride;
    }

    private function assigned(Request $request, int $id): Ride
    {
        $ride = Ride::findOrFail($id);
        abort_unless($ride->driver_id === $request->user()->id, 404);

        return $ride;
    }

    private function respond(Request $request, Ride $ride)
    {
        return response()->json(RidePresenter::present($ride, $request->user()));
    }

    /** Neighbourhood only, before accept: "KN 3 Rd, Kiyovu, Nyarugenge" → "Kiyovu, Nyarugenge" */
    private static function area(?string $address): string
    {
        if (!$address) {
            return 'Nearby';
        }
        $parts = array_map('trim', explode(',', PlaceSearch::shortAddress($address)));

        return count($parts) > 1 ? implode(', ', array_slice($parts, -2)) : $parts[0];
    }
}
