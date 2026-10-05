<?php

namespace App\Services\Rides;

use App\Models\DriverPresence;
use App\Models\DriverProfile;
use App\Models\DriverRate;
use App\Models\Ride;
use App\Models\RideDispatch;
use App\Models\RideEvent;
use App\Models\RideRating;
use App\Models\User;
use App\Services\PushService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Ride state machine (RIDE_HAILING_PLAN.md §5.4). Every transition:
 *  - is an atomic conditional update on the expected current status (race-safe),
 *  - writes a ride_events row (audit trail, S8.3),
 *  - notifies the other party.
 *
 *   requested ──accept──▶ accepted ──arrive──▶ arrived ──start(PIN)──▶ in_progress ──complete──▶ completed
 *       │ decline/timeout                │ cancel (rider/driver)
 *       ▼                                ▼
 *   declined / expired          cancelled_by_rider / cancelled_by_driver
 */
class RideService
{
    public const MAX_PIN_ATTEMPTS = 5;
    public const CANCEL_REASONS_RIDER = ['changed_plans', 'driver_too_far', 'driver_asked_to_cancel', 'found_other_transport', 'wrong_pickup', 'other'];
    public const CANCEL_REASONS_DRIVER = ['rider_not_at_pickup', 'rider_asked_to_cancel', 'vehicle_problem', 'unsafe', 'traffic', 'other'];

    public function __construct(private FareService $fares, private PushService $push)
    {
    }

    // ── Rider ────────────────────────────────────────────────────────────

    /**
     * Request one specific driver (mode "pick", story S3.4). The price is computed here from
     * the driver's own rates and locked on the ride (S2.3) — the client never sends a price.
     */
    public function request(User $rider, int $driverId, array $pickup, array $dropoff, string $paymentMethod = 'cash'): Ride
    {
        if (Ride::where('rider_id', $rider->id)->whereIn('status', Ride::ACTIVE)->exists()) {
            throw new HttpException(409, 'You already have an active ride.');
        }
        if ($driverId === $rider->id) {
            throw ValidationException::withMessages(['driver_id' => 'You cannot request yourself.']);
        }

        $presence = DriverPresence::live()->with('driver.driverProfile', 'vehicle')->find($driverId);
        $rate = $presence?->vehicle ? DriverRate::where([
            'user_id' => $driverId, 'vehicle_id' => $presence->vehicle_id, 'service' => 'ride', 'is_active' => true,
        ])->whereNull('out_of_band_at')->first() : null;

        if (!$presence || !$rate || !$presence->vehicle->is_active
            || $presence->driver->driverProfile?->verification_status !== DriverProfile::STATUS_VERIFIED) {
            throw new HttpException(409, 'This driver is no longer available. Choose another driver.');
        }
        if (self::driverBusy($driverId)) {
            throw new HttpException(409, 'This driver just got another ride. Choose another driver.');
        }

        $settings = RideSettings::get();
        $tripKm = GeoService::roadKm($pickup['lat'], $pickup['lng'], $dropoff['lat'], $dropoff['lng']);
        $pickupKm = GeoService::roadKm($presence->lat, $presence->lng, $pickup['lat'], $pickup['lng']);
        $quote = $this->fares->quote($rate->fareSnapshot(), $tripKm, $pickupKm);

        $ride = DB::transaction(function () use ($rider, $presence, $rate, $pickup, $dropoff, $paymentMethod, $settings, $tripKm, $pickupKm, $quote) {
            $ride = Ride::create([
                'rider_id'        => $rider->id,
                'driver_id'       => $presence->user_id,
                'vehicle_id'      => $presence->vehicle_id,
                'mode'            => 'pick',
                'vehicle_class'   => $presence->vehicle->class,
                'status'          => Ride::REQUESTED,
                'pickup_lat'      => $pickup['lat'],
                'pickup_lng'      => $pickup['lng'],
                'pickup_address'  => $pickup['address'] ?? null,
                'dropoff_lat'     => $dropoff['lat'],
                'dropoff_lng'     => $dropoff['lng'],
                'dropoff_address' => $dropoff['address'] ?? null,
                'est_distance_km' => $tripKm,
                'est_minutes'     => max(1, (int) ceil($tripKm / NearbyDrivers::CITY_KMH * 60)),
                'pickup_km'       => $pickupKm,
                'rate_snapshot'   => $rate->fareSnapshot() + ['is_night' => $quote['is_night']],
                'driver_fare'     => $quote['driver_fare'],
                'service_fee'     => $quote['service_fee'],
                'quoted_fare'     => $quote['total'],
                'commission_pct'  => $settings['commission_pct'],
                'start_pin'       => str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT),
                'payment_method'  => $paymentMethod,
                'requested_at'    => now(),
                'expires_at'      => now()->addSeconds((int) $settings['request_timeout_sec']),
            ]);
            RideDispatch::create([
                'ride_id' => $ride->id, 'driver_id' => $presence->user_id, 'quote' => $quote['driver_fare'], 'sent_at' => now(),
            ]);
            $this->event($ride, $rider, 'requested', ['driver_id' => $presence->user_id, 'quote' => $quote['total']]);

            return $ride->fresh();   // load DB defaults (cancel_fee, pin_attempts…)
        });

        $this->push->send($presence->driver, 'New ride request',
            sprintf('%s → %s · you earn %s RWF', $ride->pickup_address ?? 'Pickup', $ride->dropoff_address ?? 'destination', number_format($ride->driver_fare)),
            ['screen' => 'driver_ride', 'id' => $ride->id]);

        return $ride;
    }

    public function cancel(Ride $ride, User $user, string $reason): Ride
    {
        $isRider = $ride->rider_id === $user->id;
        $allowed = $isRider ? [Ride::REQUESTED, Ride::ACCEPTED, Ride::ARRIVED] : [Ride::ACCEPTED, Ride::ARRIVED];
        $reasons = $isRider ? self::CANCEL_REASONS_RIDER : self::CANCEL_REASONS_DRIVER;
        if (!in_array($reason, $reasons, true)) {
            throw ValidationException::withMessages(['reason' => 'Choose a cancellation reason.']);
        }

        $fee = $isRider ? self::cancelFee($ride) : 0;
        $ride = $this->transition($ride, $user, $allowed, [
            'status'        => $isRider ? Ride::CANCELLED_BY_RIDER : Ride::CANCELLED_BY_DRIVER,
            'cancelled_at'  => now(),
            'cancelled_by'  => $isRider ? 'rider' : 'driver',
            'cancel_reason' => $reason,
            'cancel_fee'    => $fee,
        ], 'cancelled', ['by' => $isRider ? 'rider' : 'driver', 'reason' => $reason, 'fee' => $fee]);

        RideDispatch::where('ride_id', $ride->id)->where('status', 'sent')->update(['status' => 'withdrawn', 'responded_at' => now()]);

        $other = $isRider ? $ride->driver : $ride->rider;
        if ($other) {
            $this->push->send($other, $isRider ? 'The rider cancelled' : 'Your driver cancelled',
                $isRider ? 'This ride was cancelled by the rider.' : 'Choose another driver — your request was cancelled.',
                ['screen' => $isRider ? 'driver' : 'ride', 'id' => $ride->id]);
        }

        return $ride;
    }

    /** Fee when the rider cancels after the driver has waited longer than the free time. */
    public static function cancelFee(Ride $ride): int
    {
        $settings = RideSettings::get();
        if ($ride->status !== Ride::ARRIVED || !$ride->arrived_at) {
            return 0;
        }

        return $ride->arrived_at->copy()->addMinutes((int) $settings['free_wait_min'])->isPast() ? (int) $settings['cancel_fee'] : 0;
    }

    public function rate(Ride $ride, User $user, int $stars, array $tags = [], ?string $comment = null): RideRating
    {
        if ($ride->status !== Ride::COMPLETED) {
            throw new HttpException(409, 'You can rate a ride once it is completed.');
        }
        if (RideRating::where(['ride_id' => $ride->id, 'from_user_id' => $user->id])->exists()) {
            throw new HttpException(409, 'You already rated this ride.');
        }
        $toUserId = $ride->rider_id === $user->id ? $ride->driver_id : $ride->rider_id;

        return DB::transaction(function () use ($ride, $user, $toUserId, $stars, $tags, $comment) {
            $rating = RideRating::create([
                'ride_id' => $ride->id, 'from_user_id' => $user->id, 'to_user_id' => $toUserId,
                'stars' => $stars, 'tags' => $tags ?: null, 'comment' => $comment,
            ]);
            // Rider rating a driver updates the driver's public rating
            if ($toUserId === $ride->driver_id && ($profile = DriverProfile::where('user_id', $toUserId)->first())) {
                $stats = RideRating::where('to_user_id', $toUserId)
                    ->whereIn('ride_id', Ride::where('driver_id', $toUserId)->select('id'))
                    ->selectRaw('AVG(stars) as avg, COUNT(*) as n')->first();
                $profile->forceFill(['rating_avg' => round((float) $stats->avg, 1), 'rating_count' => (int) $stats->n])->save();
            }
            $this->event($ride, $user, 'rated', ['stars' => $stars]);

            return $rating;
        });
    }

    // ── Driver ───────────────────────────────────────────────────────────

    /** Atomic accept: only one driver can win; expired requests can't be accepted (story S5.2). */
    public function accept(Ride $ride, User $driver): Ride
    {
        if ($ride->expires_at && $ride->expires_at->isPast() && $ride->status === Ride::REQUESTED) {
            $this->expire($ride);
            throw new HttpException(409, 'This request has expired.');
        }

        $won = Ride::whereKey($ride->id)
            ->where('status', Ride::REQUESTED)
            ->where('driver_id', $driver->id)
            ->update(['status' => Ride::ACCEPTED, 'accepted_at' => now(), 'updated_at' => now()]);
        if (!$won) {
            throw new HttpException(409, 'Ride taken or no longer available.');
        }

        RideDispatch::where(['ride_id' => $ride->id, 'driver_id' => $driver->id])->update(['status' => 'accepted', 'responded_at' => now()]);
        $ride = $ride->fresh();
        $this->event($ride, $driver, 'accepted');
        $this->push->send($ride->rider, 'Your driver is on the way',
            sprintf('%s is coming in a %s %s · %s', NearbyDrivers::displayName($driver->name),
                $ride->vehicle?->color ?? '', $ride->vehicle?->model ?? 'car', $ride->vehicle?->plate ?? ''),
            ['screen' => 'ride', 'id' => $ride->id]);

        return $ride;
    }

    public function decline(Ride $ride, User $driver): Ride
    {
        $ride = $this->transition($ride, $driver, [Ride::REQUESTED], ['status' => Ride::DECLINED], 'declined');
        RideDispatch::where(['ride_id' => $ride->id, 'driver_id' => $driver->id])->update(['status' => 'declined', 'responded_at' => now()]);
        $this->push->send($ride->rider, 'Driver unavailable', 'Your driver declined. Choose another driver in one tap.',
            ['screen' => 'ride', 'id' => $ride->id]);

        return $ride;
    }

    public function arrive(Ride $ride, User $driver): Ride
    {
        $ride = $this->transition($ride, $driver, [Ride::ACCEPTED], ['status' => Ride::ARRIVED, 'arrived_at' => now()], 'arrived');
        $this->push->send($ride->rider, 'Your driver has arrived',
            sprintf('Look for %s · Your PIN is %s', $ride->vehicle?->plate ?? 'your driver', $ride->start_pin),
            ['screen' => 'ride', 'id' => $ride->id]);

        return $ride;
    }

    /** Start only with the rider's PIN (story S4.2). */
    public function start(Ride $ride, User $driver, string $pin): Ride
    {
        $this->assertDriver($ride, $driver);
        if ($ride->status !== Ride::ARRIVED) {
            throw new HttpException(409, 'You can start the trip once you have arrived at the pickup.');
        }
        if ($ride->pin_attempts >= self::MAX_PIN_ATTEMPTS) {
            throw new HttpException(423, 'Too many wrong PINs. Jali support has been alerted.');
        }
        if (!hash_equals($ride->start_pin, $pin)) {
            $ride->increment('pin_attempts');
            $this->event($ride, $driver, 'wrong_pin', ['attempt' => $ride->pin_attempts]);
            if ($ride->pin_attempts >= self::MAX_PIN_ATTEMPTS) {
                $ride->update(['flagged_at' => now()]);
                $this->event($ride, null, 'flagged', ['reason' => 'too_many_wrong_pins']);
            }
            throw ValidationException::withMessages(['pin' => 'Wrong PIN. Ask the rider for the 4-digit PIN in their app.']);
        }

        $ride = $this->transition($ride, $driver, [Ride::ARRIVED], ['status' => Ride::IN_PROGRESS, 'started_at' => now()], 'started');
        $this->push->send($ride->rider, 'Trip started', 'Enjoy your ride with Jali.', ['screen' => 'ride', 'id' => $ride->id]);

        return $ride;
    }

    /** End the trip at the locked price and record how the rider paid (story S4.4). */
    public function complete(Ride $ride, User $driver, string $paymentMethod): Ride
    {
        $commission = (int) round($ride->driver_fare * $ride->commission_pct / 100);
        $ride = $this->transition($ride, $driver, [Ride::IN_PROGRESS], [
            'status'         => Ride::COMPLETED,
            'completed_at'   => now(),
            'final_fare'     => $ride->quoted_fare,
            'commission'     => $commission,
            'payment_method' => $paymentMethod,
        ], 'completed', ['final_fare' => $ride->quoted_fare, 'payment_method' => $paymentMethod, 'commission' => $commission]);

        DriverProfile::where('user_id', $driver->id)->increment('trips_count');
        $this->push->send($ride->rider, 'You have arrived',
            sprintf('Trip total %s RWF (%s). Tap to rate your driver.', number_format($ride->final_fare), $paymentMethod === 'momo' ? 'MoMo' : 'cash'),
            ['screen' => 'ride', 'id' => $ride->id]);

        return $ride;
    }

    // ── System ───────────────────────────────────────────────────────────

    public function expire(Ride $ride): bool
    {
        $done = Ride::whereKey($ride->id)->where('status', Ride::REQUESTED)
            ->update(['status' => Ride::EXPIRED, 'updated_at' => now()]);
        if ($done) {
            RideDispatch::where('ride_id', $ride->id)->where('status', 'sent')->update(['status' => 'expired', 'responded_at' => now()]);
            $this->event($ride, null, 'expired');
            $this->push->send($ride->rider, 'No answer from the driver', 'Choose another driver in one tap.', ['screen' => 'ride', 'id' => $ride->id]);
        }

        return (bool) $done;
    }

    public static function driverBusy(int $driverId): bool
    {
        return Ride::where('driver_id', $driverId)->whereIn('status', Ride::ACTIVE)->exists();
    }

    // ── Internals ────────────────────────────────────────────────────────

    private function assertDriver(Ride $ride, User $driver): void
    {
        if ($ride->driver_id !== $driver->id) {
            throw new HttpException(404, 'Ride not found.');
        }
    }

    /** Conditional update from one of $from statuses; 409 if the ride moved on meanwhile. */
    private function transition(Ride $ride, User $actor, array $from, array $changes, string $event, array $payload = []): Ride
    {
        if (!$ride->involves($actor)) {
            throw new HttpException(404, 'Ride not found.');
        }
        $updated = Ride::whereKey($ride->id)->whereIn('status', $from)->update($changes + ['updated_at' => now()]);
        if (!$updated) {
            throw new HttpException(409, "This ride can't be changed any more (it is {$ride->fresh()->status}).");
        }
        $ride = $ride->fresh();
        $this->event($ride, $actor, $event, $payload);

        return $ride;
    }

    private function event(Ride $ride, ?User $actor, string $type, array $payload = []): void
    {
        RideEvent::create(['ride_id' => $ride->id, 'actor_id' => $actor?->id, 'type' => $type, 'payload' => $payload ?: null]);
    }
}
