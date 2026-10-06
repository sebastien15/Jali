<?php

namespace App\Modules\NearbyRides\Application;

use App\Models\Ride;
use App\Models\RideDispatch;
use App\Models\User;
use App\Modules\Locations\Contracts\Geography;

/**
 * Ride reads for the rider and the driver. Overdue requests are expired before
 * they are shown (story S5.2), and a ride is only visible to its rider and its
 * assigned driver (or, for a broadcast, a driver it was offered to).
 */
class RideQueries
{
    public function __construct(private RideService $rides, private Geography $geo)
    {
    }

    /** GET /rides — the rider's own rides, newest first, 20 per page */
    public function riderPage(User $rider): array
    {
        $page = Ride::where('rider_id', $rider->id)->orderByDesc('id')->paginate(20);

        return [
            'data'      => collect($page->items())->map(fn (Ride $r) => RidePresenter::present($r, $rider))->values(),
            'next_page' => $page->hasMorePages() ? $page->currentPage() + 1 : null,
        ];
    }

    /** My current ride as rider (any active status) or driver (once accepted), or null */
    public function activeRide(User $user): ?Ride
    {
        $ride = Ride::whereIn('status', Ride::ACTIVE)
            ->where(fn ($q) => $q->where('rider_id', $user->id)->orWhere(fn ($q) => $q->where('driver_id', $user->id)->whereIn('status', Ride::ONGOING)))
            ->orderByDesc('id')->first();

        if ($ride && $this->rides->expireIfLate($ride)) {
            $ride = $ride->fresh();
        }

        return $ride;
    }

    /** A ride the user is the rider or assigned driver of; 404 for anyone else */
    public function participantRide(User $user, int $id): Ride
    {
        $ride = Ride::findOrFail($id);
        abort_unless($ride->involves($user), 404);

        return $ride;
    }

    /** GET /rides/{id} — lazily expired */
    public function shownRide(User $user, int $id): Ride
    {
        $ride = $this->participantRide($user, $id);
        if ($this->rides->expireIfLate($ride)) {
            $ride = $ride->fresh();
        }

        return $ride;
    }

    /** Assigned to the driver, or a broadcast they were offered (S3.5); 404 otherwise */
    public function offeredRide(User $driver, int $id): Ride
    {
        $ride = Ride::findOrFail($id);
        $mine = $ride->driver_id === $driver->id;
        $offered = $ride->mode === 'broadcast' && RideDispatch::where(['ride_id' => $ride->id, 'driver_id' => $driver->id])->exists();
        abort_unless($mine || $offered, 404);

        return $ride;
    }

    /** Assigned to the driver; 404 otherwise */
    public function assignedRide(User $driver, int $id): Ride
    {
        $ride = Ride::findOrFail($id);
        abort_unless($ride->driver_id === $driver->id, 404);

        return $ride;
    }

    /** GET /driver/ride-requests — what a driver sees before accepting (no exact pickup, no phone) */
    public function driverRequests(User $driver): array
    {
        $dispatches = RideDispatch::with('ride.rider')
            ->where('driver_id', $driver->id)->where('status', 'sent')
            ->whereHas('ride', fn ($q) => $q->where('status', Ride::REQUESTED))
            ->orderBy('id')->get();

        $cards = [];
        foreach ($dispatches as $d) {
            $ride = $d->ride;
            if ($ride->expires_at?->isPast()) {
                $this->rides->expire($ride);
                continue;
            }
            // Broadcast: each driver sees their own price (S3.5)
            $driverFare = $d->fare['driver_fare'] ?? $ride->driver_fare;
            $commission = (int) round($driverFare * $ride->commission_pct / 100);
            $cards[] = [
                'ride_id'        => $ride->id,
                'pickup_area'    => $this->area($ride->pickup_address),
                'dropoff_area'   => $this->area($ride->dropoff_address),
                'trip_km'        => $ride->est_distance_km,
                'pickup_km'      => $d->fare['pickup_km'] ?? $ride->pickup_km,
                'earnings'       => $driverFare - $commission,
                'broadcast'      => $ride->mode === 'broadcast',
                'rider_rating'   => RidePresenter::riderRating($ride->rider_id),
                'payment_method' => $ride->payment_method ?? 'cash',
                'expires_at'     => $ride->expires_at?->toIso8601String(),
            ];
        }

        return $cards;
    }

    /** Neighbourhood only, before accept: "KN 3 Rd, Kiyovu, Nyarugenge" → "Kiyovu, Nyarugenge" */
    private function area(?string $address): string
    {
        if (!$address) {
            return 'Nearby';
        }
        $parts = array_map('trim', explode(',', $this->geo->shortPlaceName($address)));

        return count($parts) > 1 ? implode(', ', array_slice($parts, -2)) : $parts[0];
    }
}
