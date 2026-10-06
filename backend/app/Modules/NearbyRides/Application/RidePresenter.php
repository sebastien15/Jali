<?php

namespace App\Modules\NearbyRides\Application;

use App\Models\DriverPresence;
use App\Models\Ride;
use App\Models\RideRating;
use App\Models\User;

/**
 * JSON shape of a ride for one viewer (contract schema "Ride").
 * Privacy: the PIN only goes to the rider; phone numbers and exact driver
 * position only once a driver is assigned and on the way.
 */
class RidePresenter
{
    public static function present(Ride $ride, User $viewer): array
    {
        $ride->loadMissing('driver.driverProfile', 'vehicle', 'rider');
        $isRider = $ride->rider_id === $viewer->id;
        $ongoing = in_array($ride->status, Ride::ONGOING, true);

        $driver = null;
        if ($ride->driver) {
            $location = null;
            if ($ongoing && ($p = DriverPresence::find($ride->driver_id)) && $p->lat !== null) {
                $location = ['lat' => $p->lat, 'lng' => $p->lng, 'heading' => $p->heading, 'at' => $p->last_seen_at?->toIso8601String()];
            }
            $photos = (array) ($ride->vehicle?->photos ?? []);
            $driver = [
                'id'       => $ride->driver_id,
                'name'     => NearbyDrivers::displayName($ride->driver->name),
                'photo'    => preg_match('#^https?://#', (string) $ride->driver->profile_image_url) ? $ride->driver->profile_image_url : null,
                'rating'   => (float) ($ride->driver->driverProfile?->rating_avg ?? 0),
                'phone'    => $ongoing && $isRider ? $ride->driver->phone : null,
                // S7.1: rider pays the driver's MoMo directly — shown once the trip has started
                'momo'     => $isRider && $ride->payment_method === 'momo' && in_array($ride->status, [Ride::IN_PROGRESS, Ride::COMPLETED], true)
                    && $ride->driver->driverProfile?->momo_number
                    ? ['number' => $ride->driver->driverProfile->momo_number, 'name' => $ride->driver->driverProfile->momo_name]
                    : null,
                'location' => $location,
                'vehicle'  => $ride->vehicle ? [
                    'class' => $ride->vehicle->class,
                    'model' => trim(($ride->vehicle->make ? $ride->vehicle->make . ' ' : '') . $ride->vehicle->model),
                    'color' => $ride->vehicle->color,
                    'plate' => $ride->vehicle->plate,
                    'photo' => $photos['front'] ?? null,
                ] : null,
            ];
        }

        $myRating = RideRating::where(['ride_id' => $ride->id, 'from_user_id' => $viewer->id])->value('stars');

        return [
            'id'              => $ride->id,
            'role'            => $isRider ? 'rider' : 'driver',
            'status'          => $ride->status,
            'mode'            => $ride->mode,
            'vehicle_class'   => $ride->vehicle_class,
            'pickup'          => ['lat' => $ride->pickup_lat, 'lng' => $ride->pickup_lng, 'address' => $ride->pickup_address],
            'dropoff'         => ['lat' => $ride->dropoff_lat, 'lng' => $ride->dropoff_lng, 'address' => $ride->dropoff_address],
            'est_distance_km' => $ride->est_distance_km,
            'est_minutes'     => $ride->est_minutes,
            'quoted_fare'     => $ride->quoted_fare,
            'max_fare'        => $ride->max_fare,
            'driver_fare'     => $ride->driver_fare,
            'service_fee'     => $ride->service_fee,
            'final_fare'      => $ride->final_fare,
            'driver_earnings' => $isRider ? null : $ride->driver_fare - ($ride->commission ?? (int) round($ride->driver_fare * $ride->commission_pct / 100)),
            'cancel_fee'      => $ride->cancel_fee,
            'cancel_reason'   => $ride->cancel_reason,
            'start_pin'       => $isRider && in_array($ride->status, Ride::ACTIVE, true) ? $ride->start_pin : null,
            'payment_method'  => $ride->payment_method,
            'expires_at'      => $ride->status === Ride::REQUESTED ? $ride->expires_at?->toIso8601String() : null,
            'driver'          => $driver,
            'rider'           => $isRider ? null : [
                'name'   => NearbyDrivers::displayName($ride->rider->name),
                'rating' => self::riderRating($ride->rider_id),
                'phone'  => $ongoing ? $ride->rider->phone : null,
            ],
            'my_rating'       => $myRating,
            'requested_at'    => $ride->requested_at?->toIso8601String(),
            'accepted_at'     => $ride->accepted_at?->toIso8601String(),
            'arrived_at'      => $ride->arrived_at?->toIso8601String(),
            'started_at'      => $ride->started_at?->toIso8601String(),
            'completed_at'    => $ride->completed_at?->toIso8601String(),
            'cancelled_at'    => $ride->cancelled_at?->toIso8601String(),
        ];
    }

    public static function riderRating(int $riderId): ?float
    {
        $avg = RideRating::where('to_user_id', $riderId)
            ->whereIn('ride_id', Ride::where('rider_id', $riderId)->select('id'))
            ->avg('stars');

        return $avg !== null ? round((float) $avg, 1) : null;
    }
}
