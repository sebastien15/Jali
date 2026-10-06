<?php

namespace App\Modules\NearbyRides\Application;

use App\Models\DriverPresence;
use App\Models\DriverProfile;
use App\Models\DriverRate;
use App\Models\Ride;
use App\Models\RideDispatch;
use App\Models\RideEvent;
use App\Models\RideRating;
use App\Models\User;
use App\Models\Vehicle;
use App\Modules\Locations\Contracts\Geography;
use App\Modules\Payments\Contracts\MoneyRecorder;
use App\Modules\Payments\Contracts\ReceiptMailer;
use App\Modules\Pricing\Contracts\PricingPolicy;
use App\Modules\Providers\Contracts\ProviderReputation;
use App\Modules\ServiceAccess\Contracts\ServiceAccess;
use App\Modules\Notifications\Contracts\PushSender;
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

    public function __construct(
        private FareService $fares,
        private PushSender $push,
        private PricingPolicy $pricing,
        private Geography $geo,
        private MoneyRecorder $money,
        private ReceiptMailer $receipts,
        private ProviderReputation $reputation,
        private AreaRideSettings $area,
    ) {
    }

    // ── Rider ────────────────────────────────────────────────────────────

    /**
     * Request one specific driver (mode "pick", story S3.4). The price is computed here from
     * the driver's own rates and locked on the ride (S2.3) — the client never sends a price.
     */
    public function request(User $rider, int $driverId, array $pickup, array $dropoff, string $paymentMethod = 'cash'): Ride
    {
        $this->assertCanRequest($rider);
        if ($driverId === $rider->id) {
            throw ValidationException::withMessages(['driver_id' => 'You cannot request yourself.']);
        }
        $this->area->assertServed($pickup['lat'], $pickup['lng']);
        $offer = $this->offerFrom($driverId, $pickup, $dropoff);
        if (!$offer) {
            throw new HttpException(409, 'This driver is no longer available. Choose another driver.');
        }
        if (self::driverBusy($driverId)) {
            throw new HttpException(409, 'This driver just got another ride. Choose another driver.');
        }

        $ride = DB::transaction(function () use ($rider, $offer, $pickup, $dropoff, $paymentMethod) {
            $ride = $this->createRide($rider, 'pick', $offer, $pickup, $dropoff, $paymentMethod, [
                'driver_id' => $offer['driver']->id, 'vehicle_id' => $offer['vehicle']->id,
            ]);
            RideDispatch::create([
                'ride_id' => $ride->id, 'driver_id' => $offer['driver']->id, 'quote' => $offer['quote']['driver_fare'],
                'fare' => $offer['fare'], 'sent_at' => now(),
            ]);
            $this->event($ride, $rider, 'requested', ['driver_id' => $offer['driver']->id, 'quote' => $offer['quote']['total']]);

            return $ride->fresh();   // load DB defaults (cancel_fee, pin_attempts…)
        });

        $this->push->send($offer['driver'], 'New ride request',
            sprintf('%s → %s · you earn %s RWF', $ride->pickup_address ?? 'Pickup', $ride->dropoff_address ?? 'destination', number_format($ride->driver_fare)),
            ['screen' => 'driver_ride', 'id' => $ride->id]);

        return $ride;
    }

    /**
     * Send the request to the N nearest drivers whose own price is within max_fare
     * (mode "broadcast", story S3.5). The first driver to accept wins at their own price.
     */
    public function requestBroadcast(User $rider, array $pickup, array $dropoff, string $paymentMethod = 'cash',
                                     ?string $class = null, ?int $maxFare = null): Ride
    {
        $this->assertCanRequest($rider);
        $settings = $this->area->at($pickup['lat'], $pickup['lng']);
        $nearby = app(NearbyDrivers::class)->search($pickup['lat'], $pickup['lng'], $dropoff['lat'], $dropoff['lng'], $class, $rider->id);

        $offers = [];
        foreach ($nearby['drivers'] as $candidate) {
            if ($maxFare !== null && $candidate['quote'] > $maxFare) {
                continue;
            }
            if ($offer = $this->offerFrom($candidate['driver_id'], $pickup, $dropoff)) {
                $offers[] = $offer;
            }
            if (count($offers) >= (int) $settings['broadcast_max_drivers']) {
                break;
            }
        }
        if (!$offers) {
            throw new HttpException(409, $maxFare !== null
                ? 'No driver nearby is available at or under your maximum price. Raise it or choose a driver.'
                : 'No driver is available nearby right now.');
        }

        // Until a driver accepts, the ride shows the lowest price on offer
        usort($offers, fn ($a, $b) => $a['quote']['total'] <=> $b['quote']['total']);
        $ride = DB::transaction(function () use ($rider, $offers, $pickup, $dropoff, $paymentMethod, $class, $maxFare) {
            $ride = $this->createRide($rider, 'broadcast', $offers[0], $pickup, $dropoff, $paymentMethod, [
                'driver_id' => null, 'vehicle_id' => null, 'max_fare' => $maxFare,
                'vehicle_class' => $class ?? $offers[0]['vehicle']->class,
            ]);
            foreach ($offers as $offer) {
                RideDispatch::create([
                    'ride_id' => $ride->id, 'driver_id' => $offer['driver']->id, 'quote' => $offer['quote']['driver_fare'],
                    'fare' => $offer['fare'], 'sent_at' => now(),
                ]);
            }
            $this->event($ride, $rider, 'requested', ['mode' => 'broadcast', 'drivers' => count($offers), 'max_fare' => $maxFare]);

            return $ride->fresh();
        });

        foreach ($offers as $offer) {
            $this->push->send($offer['driver'], 'New ride request',
                sprintf('%s → %s · you earn %s RWF · first to accept wins', $ride->pickup_address ?? 'Pickup', $ride->dropoff_address ?? 'destination',
                    number_format($offer['quote']['driver_fare'])),
                ['screen' => 'driver_ride', 'id' => $ride->id]);
        }

        return $ride;
    }

    /** Price range and nearest ETA per vehicle class (story S3.6) */
    public function estimate(User $rider, array $pickup, array $dropoff): array
    {
        $nearby = app(NearbyDrivers::class)->search($pickup['lat'], $pickup['lng'], $dropoff['lat'], $dropoff['lng'], null, $rider->id);
        $byClass = collect($nearby['drivers'])->groupBy(fn ($d) => $d['vehicle']['class']);

        return [
            'trip'    => $nearby['trip'],
            'classes' => collect(Vehicle::CLASSES)->map(function (string $class) use ($byClass) {
                $drivers = $byClass->get($class, collect());

                return [
                    'class'           => $class,
                    'available'       => $drivers->isNotEmpty(),
                    'drivers'         => $drivers->count(),
                    'min_quote'       => $drivers->min('quote'),
                    'max_quote'       => $drivers->max('quote'),
                    'nearest_eta_min' => $drivers->min('eta_min'),
                ];
            })->values()->all(),
        ];
    }

    private function assertCanRequest(User $rider): void
    {
        app(ServiceAccess::class)->assertAcceptingNew('rides');   // S23.1
        if (Ride::where('rider_id', $rider->id)->whereIn('status', Ride::ACTIVE)->exists()) {
            throw new HttpException(409, 'You already have an active ride.');
        }
    }

    /** One driver's locked price for this trip, or null when they can't take it */
    private function offerFrom(int $driverId, array $pickup, array $dropoff): ?array
    {
        $presence = DriverPresence::live()->with('driver.driverProfile', 'vehicle')->find($driverId);
        $rate = $presence?->vehicle ? DriverRate::where([
            'user_id' => $driverId, 'vehicle_id' => $presence->vehicle_id, 'service' => 'ride', 'is_active' => true,
        ])->whereNull('out_of_band_at')->first() : null;

        if (!$presence || !$rate || !$presence->vehicle->is_active
            || $presence->driver->driverProfile?->verification_status !== DriverProfile::STATUS_VERIFIED
            || !AreaRideSettings::rateFits($this->area->at($pickup['lat'], $pickup['lng']), $rate, $presence->vehicle->class)) {
            return null;
        }

        $tripKm = $this->geo->roadDistanceKm($pickup['lat'], $pickup['lng'], $dropoff['lat'], $dropoff['lng']);
        $pickupKm = $this->geo->roadDistanceKm($presence->lat, $presence->lng, $pickup['lat'], $pickup['lng']);
        $quote = $this->fares->quote($rate->fareSnapshot(), $tripKm, $pickupKm);

        return [
            'driver' => $presence->driver, 'vehicle' => $presence->vehicle, 'quote' => $quote,
            'trip_km' => $tripKm, 'pickup_km' => $pickupKm,
            // Everything copied onto the ride when this driver wins
            'fare' => [
                'vehicle_id'    => $presence->vehicle_id,
                'vehicle_class' => $presence->vehicle->class,
                'pickup_km'     => $pickupKm,
                'rate_snapshot' => $rate->fareSnapshot() + ['is_night' => $quote['is_night']],
                'driver_fare'   => $quote['driver_fare'],
                'service_fee'   => $quote['service_fee'],
                'quoted_fare'   => $quote['total'],
            ],
        ];
    }

    private function createRide(User $rider, string $mode, array $offer, array $pickup, array $dropoff, string $paymentMethod, array $extra): Ride
    {
        $settings = $this->area->at($pickup['lat'], $pickup['lng']);   // city commission (S10.4)
        $fare = $offer['fare'];

        return Ride::create($extra + [
            'rider_id'        => $rider->id,
            'mode'            => $mode,
            'vehicle_class'   => $fare['vehicle_class'],
            'status'          => Ride::REQUESTED,
            'pickup_lat'      => $pickup['lat'],
            'pickup_lng'      => $pickup['lng'],
            'pickup_address'  => $pickup['address'] ?? null,
            'dropoff_lat'     => $dropoff['lat'],
            'dropoff_lng'     => $dropoff['lng'],
            'dropoff_address' => $dropoff['address'] ?? null,
            'est_distance_km' => $offer['trip_km'],
            'est_minutes'     => max(1, (int) ceil($offer['trip_km'] / NearbyDrivers::CITY_KMH * 60)),
            'pickup_km'       => $fare['pickup_km'],
            'rate_snapshot'   => $fare['rate_snapshot'],
            'driver_fare'     => $fare['driver_fare'],
            'service_fee'     => $fare['service_fee'],
            'quoted_fare'     => $fare['quoted_fare'],
            'commission_pct'  => $settings['commission_pct'],
            'start_pin'       => str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT),
            'payment_method'  => $paymentMethod,
            'requested_at'    => now(),
            'expires_at'      => now()->addSeconds((int) $settings['request_timeout_sec']),
        ]);
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
        $settings = app(AreaRideSettings::class)->at((float) $ride->pickup_lat, (float) $ride->pickup_lng);
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
            if ($toUserId === $ride->driver_id) {
                $this->reputation->refreshProviderRating($toUserId);   // rides and hires together
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

        if ($ride->mode === 'broadcast') {
            $won = $this->acceptBroadcast($ride, $driver);
        } else {
            $won = Ride::whereKey($ride->id)
                ->where('status', Ride::REQUESTED)
                ->where('driver_id', $driver->id)
                ->update(['status' => Ride::ACCEPTED, 'accepted_at' => now(), 'updated_at' => now()]);
        }
        if (!$won) {
            throw new HttpException(409, 'Ride taken or no longer available.');
        }

        RideDispatch::where(['ride_id' => $ride->id, 'driver_id' => $driver->id])->update(['status' => 'accepted', 'responded_at' => now()]);
        // Everyone else's card disappears (S3.5)
        RideDispatch::where('ride_id', $ride->id)->where('driver_id', '!=', $driver->id)->where('status', 'sent')
            ->update(['status' => 'withdrawn', 'responded_at' => now()]);
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
        if ($ride->mode === 'broadcast' && $ride->driver_id === null) {
            return $this->declineBroadcast($ride, $driver);
        }
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
        $this->money->recordRide($ride);   // S7.2
        $this->receipts->emailReceipt('ride', $ride);   // S9.6
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

    /** rides:expire-requests — every overdue request; returns how many were expired */
    public function expireOverdue(): int
    {
        $count = 0;
        Ride::where('status', Ride::REQUESTED)->where('expires_at', '<', now())->each(function (Ride $ride) use (&$count) {
            $count += (int) $this->expire($ride);
        });

        return $count;
    }

    /** Lazy expiry before a read, so nobody sees a stale "requested" ride */
    public function expireIfLate(Ride $ride): bool
    {
        return $ride->status === Ride::REQUESTED && $ride->expires_at?->isPast() && $this->expire($ride);
    }

    /** First accepting driver wins and the ride takes their own locked price */
    private function acceptBroadcast(Ride $ride, User $driver): bool
    {
        $dispatch = RideDispatch::where(['ride_id' => $ride->id, 'driver_id' => $driver->id, 'status' => 'sent'])->first();
        if (!$dispatch || !is_array($dispatch->fare) || self::driverBusy($driver->id)) {
            return false;
        }
        $fare = $dispatch->fare;

        return (bool) Ride::whereKey($ride->id)
            ->where('status', Ride::REQUESTED)
            ->whereNull('driver_id')
            ->update([
                'status'        => Ride::ACCEPTED,
                'accepted_at'   => now(),
                'driver_id'     => $driver->id,
                'vehicle_id'    => $fare['vehicle_id'],
                'vehicle_class' => $fare['vehicle_class'],
                'pickup_km'     => $fare['pickup_km'],
                'rate_snapshot' => json_encode($fare['rate_snapshot']),
                'driver_fare'   => $fare['driver_fare'],
                'service_fee'   => $fare['service_fee'],
                'quoted_fare'   => $fare['quoted_fare'],
                'updated_at'    => now(),
            ]);
    }

    /** A broadcast only ends as declined when every driver said no */
    private function declineBroadcast(Ride $ride, User $driver): Ride
    {
        $updated = RideDispatch::where(['ride_id' => $ride->id, 'driver_id' => $driver->id, 'status' => 'sent'])
            ->update(['status' => 'declined', 'responded_at' => now()]);
        if (!$updated) {
            throw new HttpException(409, 'Ride taken or no longer available.');
        }
        $this->event($ride, $driver, 'declined', ['mode' => 'broadcast']);

        if (!RideDispatch::where(['ride_id' => $ride->id, 'status' => 'sent'])->exists()
            && Ride::whereKey($ride->id)->where('status', Ride::REQUESTED)->whereNull('driver_id')->update(['status' => Ride::DECLINED, 'updated_at' => now()])) {
            $this->push->send($ride->rider, 'No driver accepted', 'Nobody nearby could take this ride. Try again or choose a driver.',
                ['screen' => 'ride', 'id' => $ride->id]);
        }

        return $ride->fresh();
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
