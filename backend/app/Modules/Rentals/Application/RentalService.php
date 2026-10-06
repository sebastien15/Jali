<?php

namespace App\Modules\Rentals\Application;

use App\Models\CarRental;
use App\Models\RentalBooking;
use App\Models\RentalRating;
use App\Models\User;
use App\Modules\Notifications\Contracts\PushSender;
use App\Modules\ServiceAccess\Contracts\ServiceAccess;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Car rental lifecycle (stories S24.4–S24.6):
 *
 *   requested → accepted → active (handed over) → completed (returned)
 *   requested → declined | expired | cancelled
 *   accepted  → cancelled (by customer, fee by policy; or by owner)
 *
 * The car row is locked while dates are checked, so two customers can never
 * hold the same days. Transitions are conditional updates: a second tap loses.
 */
class RentalService
{
    /** Hours an owner has to answer a request (capped by the pickup time) */
    public const RESPONSE_HOURS = 12;
    /** Return after this many minutes past the end is late */
    public const LATE_GRACE_MIN = 60;
    public const MAX_DAYS = 90;
    public const CUSTOMER_CANCEL_REASONS = ['changed_plans', 'found_another_car', 'owner_asked_to_cancel', 'booked_by_mistake', 'other'];
    public const OWNER_CANCEL_REASONS = ['car_not_available', 'car_broke_down', 'customer_asked_to_cancel', 'customer_not_reachable', 'other'];

    public function __construct(private PushSender $push)
    {
    }

    public function request(User $customer, CarRental $car, array $data): RentalBooking
    {
        $start = Carbon::parse($data['start_at'])->utc();
        $end = Carbon::parse($data['end_at'])->utc();
        $delivery = ($data['pickup_method'] ?? 'pickup') === 'delivery';

        app(ServiceAccess::class)->assertAcceptingNew('rental');   // S23.1
        $this->assertBookable($customer, $car, $start, $end, $delivery);

        $booking = DB::transaction(function () use ($customer, $car, $data, $start, $end, $delivery) {
            $locked = CarRental::whereKey($car->id)->lockForUpdate()->firstOrFail();
            if (!RentalAvailability::isFree($locked, $start, $end)) {
                throw new HttpException(409, 'This car was just booked for these dates. Pick other dates or another car.');
            }
            $quote = RentalQuote::quote($locked, $start, $end, $delivery);

            return RentalBooking::create([
                'car_rental_id'    => $locked->id,
                'owner_id'         => $locked->user_id,
                'customer_id'      => $customer->id,
                'status'           => RentalBooking::REQUESTED,
                'start_at'         => $start,
                'end_at'           => $end,
                'days'             => $quote['days'],
                'pickup_method'    => $delivery ? 'delivery' : 'pickup',
                'delivery_address' => $delivery ? $data['delivery_address'] : null,
                'note'             => $data['note'] ?? null,
                'payment_method'   => $data['payment_method'] ?? 'cash',
                'quote'            => $quote,
                'terms'            => RentalQuote::terms($locked),
                'total'            => $quote['total'],
                'deposit'          => $quote['deposit'],
                'requested_at'     => now(),
                'expires_at'       => min(now()->addHours(self::RESPONSE_HOURS), $start->copy()),
            ]);
        });

        if ($car->owner) {
            $this->push->send($car->owner, 'New rental request',
                "{$customer->name} wants your {$car->name} for {$booking->days} day" . ($booking->days > 1 ? 's' : '') . '. Answer soon.',
                ['screen' => 'owner_rental', 'id' => $booking->id]);
        }

        return $booking;
    }

    /** Rules checked before the dates are locked; each failure has a message the customer can act on */
    private function assertBookable(User $customer, CarRental $car, CarbonInterface $start, CarbonInterface $end, bool $delivery): void
    {
        if (!$car->isBookable() || !$car->user_id) {
            throw new HttpException(409, 'This car is not available for rent right now.');
        }
        if ($car->user_id === $customer->id) {
            throw new HttpException(422, 'You cannot rent your own car.');
        }
        if ($end->lessThanOrEqualTo($start)) {
            throw new HttpException(422, 'The return time must be after the pickup time.');
        }
        $notice = (int) $car->notice_hours;
        if ($start->lessThan(now()->addHours($notice)->subMinutes(5))) {
            throw new HttpException(422, $notice > 0
                ? "The owner needs at least {$notice} hours' notice. Choose a later pickup time."
                : 'The pickup time has already passed.');
        }
        $days = RentalQuote::days($start, $end);
        $min = (int) ($car->min_days ?? 1);
        $max = min((int) ($car->max_days ?? self::MAX_DAYS), self::MAX_DAYS);
        if ($days < $min) {
            throw new HttpException(422, "This car is rented for at least {$min} days.");
        }
        if ($days > $max) {
            throw new HttpException(422, "This car can be rented for at most {$max} days.");
        }
        if ($delivery && !$car->delivery_available) {
            throw new HttpException(422, 'The owner does not deliver this car. Choose pickup.');
        }
        $pending = RentalBooking::where('customer_id', $customer->id)->where('car_rental_id', $car->id)
            ->whereIn('status', RentalBooking::HOLDING)->where('start_at', '<', $end)->where('end_at', '>', $start)->exists();
        if ($pending) {
            throw new HttpException(409, 'You already asked for this car on these dates.');
        }
    }

    public function accept(User $owner, RentalBooking $booking): RentalBooking
    {
        $this->transition($booking, RentalBooking::REQUESTED, RentalBooking::ACCEPTED, ['accepted_at' => now()],
            'This request is no longer waiting for an answer.', fn ($q) => $q->where('expires_at', '>', now()));
        $booking->refresh();
        $this->push->send($booking->customer, 'Rental confirmed',
            "{$owner->name} accepted your request for the {$booking->car->name}. See pickup details in the app.",
            ['screen' => 'rental', 'id' => $booking->id]);

        return $booking;
    }

    public function decline(User $owner, RentalBooking $booking, ?string $reason): RentalBooking
    {
        $this->transition($booking, RentalBooking::REQUESTED, RentalBooking::DECLINED, ['decline_reason' => $reason],
            'This request is no longer waiting for an answer.');
        $booking->refresh();
        $this->push->send($booking->customer, 'Rental not available',
            "The owner can't rent the {$booking->car->name} on those dates. Try another car.",
            ['screen' => 'rental', 'id' => $booking->id]);

        return $booking;
    }

    public function cancelByCustomer(RentalBooking $booking, string $reason): RentalBooking
    {
        if (!in_array($booking->status, [RentalBooking::REQUESTED, RentalBooking::ACCEPTED], true)) {
            throw new HttpException(409, 'This rental can no longer be cancelled here. Contact support if there is a problem.');
        }
        $fee = RentalCancellation::customerFee($booking, now());
        $this->transition($booking, $booking->status, RentalBooking::CANCELLED, [
            'cancelled_by' => 'customer', 'cancel_reason' => $reason, 'cancel_fee' => $fee, 'cancelled_at' => now(),
        ], 'This rental changed. Refresh and try again.');
        $booking->refresh();
        $this->push->send($booking->owner, 'Rental cancelled',
            "{$booking->customer->name} cancelled the {$booking->car->name} rental." . ($fee ? " Cancellation fee owed to you: {$fee} RWF." : ''),
            ['screen' => 'owner_rental', 'id' => $booking->id]);

        return $booking;
    }

    public function cancelByOwner(RentalBooking $booking, string $reason): RentalBooking
    {
        if ($booking->status !== RentalBooking::ACCEPTED) {
            throw new HttpException(409, 'Only confirmed rentals that have not started can be cancelled.');
        }
        $this->transition($booking, RentalBooking::ACCEPTED, RentalBooking::CANCELLED, [
            'cancelled_by' => 'owner', 'cancel_reason' => $reason, 'cancel_fee' => 0, 'cancelled_at' => now(),
        ], 'This rental changed. Refresh and try again.');
        $booking->refresh();
        $this->push->send($booking->customer, 'Rental cancelled by the owner',
            "Sorry — the owner cancelled your {$booking->car->name} rental. Nothing is owed. Find another car in Jali.",
            ['screen' => 'rental', 'id' => $booking->id]);

        return $booking;
    }

    /** Owner hands the car over: odometer, fuel, photos and notes are recorded (S24.6) */
    public function handover(RentalBooking $booking, array $data, array $photos): RentalBooking
    {
        if ($booking->status !== RentalBooking::ACCEPTED) {
            throw new HttpException(409, 'Only confirmed rentals can be handed over.');
        }
        if (now()->lessThan($booking->start_at->copy()->subHours(24))) {
            throw new HttpException(409, 'The car can be handed over from 24 hours before pickup.');
        }
        $record = $this->record($booking, 'handover', $data, $photos);
        $this->transition($booking, RentalBooking::ACCEPTED, RentalBooking::ACTIVE,
            ['handover' => $record, 'handed_over_at' => now()], 'This rental changed. Refresh and try again.');
        $booking->refresh();
        $this->push->send($booking->customer, 'Enjoy your trip',
            "The {$booking->car->name} is yours until " . $booking->end_at->copy()->setTimezone(RentalAvailability::TZ)->format('D j M, H:i') . '. Drive safely!',
            ['screen' => 'rental', 'id' => $booking->id]);

        return $booking;
    }

    /** Owner takes the car back; late days, extra km and listed charges make the final total */
    public function returnCar(RentalBooking $booking, array $data, array $photos): RentalBooking
    {
        if ($booking->status !== RentalBooking::ACTIVE) {
            throw new HttpException(409, 'Only rentals in progress can be returned.');
        }
        $start = (int) ($booking->handover['odometer_km'] ?? 0);
        $end = (int) $data['odometer_km'];
        if ($start && $end < $start) {
            throw new HttpException(422, "The odometer can't be lower than at handover ({$start} km).");
        }
        $charges = $this->charges($booking, $start, $end, $data['other_charges'] ?? []);
        $record = $this->record($booking, 'return', $data, $photos);

        DB::transaction(function () use ($booking, $record, $charges) {
            $this->transition($booking, RentalBooking::ACTIVE, RentalBooking::COMPLETED, [
                'return_record' => $record, 'returned_at' => now(), 'extra_charges' => $charges['items'],
                'final_total'   => (int) $booking->total + $charges['sum'],
            ], 'This rental changed. Refresh and try again.');
            CarRental::whereKey($booking->car_rental_id)->increment('trips_count');
        });
        $booking->refresh();
        $this->push->send($booking->customer, 'Rental complete',
            "Thanks for renting the {$booking->car->name}. Total: {$booking->final_total} RWF. Rate your rental in Jali.",
            ['screen' => 'rental', 'id' => $booking->id]);

        return $booking;
    }

    /** Late return, extra kilometres over the limit and owner-listed charges (fuel, cleaning, damage) */
    private function charges(RentalBooking $booking, int $startKm, int $endKm, array $other): array
    {
        $items = [];
        $lateMin = (int) $booking->end_at->diffInMinutes(now(), false);
        if ($lateMin > self::LATE_GRACE_MIN) {
            $lateDays = (int) ceil($lateMin / 1440);
            $items[] = ['type' => 'late_return', 'label' => "Late return ({$lateDays} extra day" . ($lateDays > 1 ? 's' : '') . ')',
                'amount' => $lateDays * (int) ($booking->quote['price_per_day'] ?? 0)];
        }
        $limit = $booking->terms['mileage_limit_km'] ?? null;
        if ($limit && $startKm && $endKm) {
            $over = ($endKm - $startKm) - (int) $limit * (int) $booking->days;
            $fee = (int) ($booking->terms['extra_km_fee'] ?? 0);
            if ($over > 0 && $fee > 0) {
                $items[] = ['type' => 'extra_km', 'label' => "{$over} km over the limit", 'amount' => $over * $fee];
            }
        }
        foreach ($other as $charge) {
            $items[] = ['type' => 'other', 'label' => $charge['label'], 'amount' => (int) $charge['amount']];
        }

        return ['items' => $items, 'sum' => array_sum(array_column($items, 'amount'))];
    }

    private function record(RentalBooking $booking, string $kind, array $data, array $photos): array
    {
        $urls = [];
        foreach ($photos as $photo) {
            if ($photo instanceof UploadedFile) {
                $urls[] = Storage::url($photo->store("rental-bookings/{$booking->id}/{$kind}", 'public'));
            }
        }

        return [
            'odometer_km' => (int) $data['odometer_km'],
            'fuel_level'  => (int) $data['fuel_level'],          // eighths of a tank, 0–8
            'notes'       => $data['notes'] ?? null,
            'photos'      => $urls,
            'at'          => now()->toIso8601String(),
        ];
    }

    public function rate(User $from, RentalBooking $booking, int $stars, ?string $comment): RentalRating
    {
        if ($booking->status !== RentalBooking::COMPLETED) {
            throw new HttpException(409, 'You can rate a rental once the car is returned.');
        }
        if (RentalRating::where('rental_booking_id', $booking->id)->where('from_user_id', $from->id)->exists()) {
            throw new HttpException(409, 'You already rated this rental.');
        }
        $toUser = $from->id === $booking->customer_id ? $booking->owner_id : $booking->customer_id;
        $rating = RentalRating::create([
            'rental_booking_id' => $booking->id, 'from_user_id' => $from->id, 'to_user_id' => $toUser,
            'stars' => $stars, 'comment' => $comment,
        ]);
        if ($from->id === $booking->customer_id) {
            // The car's rating is the average of customer ratings of its rentals
            $avg = RentalRating::whereIn('rental_booking_id', RentalBooking::where('car_rental_id', $booking->car_rental_id)->select('id'))
                ->where('to_user_id', $booking->owner_id)->avg('stars');
            CarRental::whereKey($booking->car_rental_id)->update(['rating' => round((float) $avg, 1)]);
        }

        return $rating;
    }

    /** Requests the owner did not answer in time (rentals:expire-requests, every minute) */
    public function expireRequests(): int
    {
        $count = 0;
        RentalBooking::with('car', 'customer')->where('status', RentalBooking::REQUESTED)
            ->where('expires_at', '<=', now())->each(function (RentalBooking $booking) use (&$count) {
                $done = RentalBooking::whereKey($booking->id)->where('status', RentalBooking::REQUESTED)
                    ->update(['status' => RentalBooking::EXPIRED, 'updated_at' => now()]);
                if ($done) {
                    $count++;
                    $this->push->send($booking->customer, 'No answer from the owner',
                        "The owner didn't answer in time, so your request for the {$booking->car->name} expired. Try another car.",
                        ['screen' => 'rental', 'id' => $booking->id]);
                }
            });

        return $count;
    }

    private function transition(RentalBooking $booking, string $from, string $to, array $changes, string $message, ?\Closure $extra = null): void
    {
        // Query-builder updates don't cast: JSON columns are encoded here
        $changes = array_map(fn ($v) => is_array($v) ? json_encode($v) : $v, $changes);
        $updated = RentalBooking::whereKey($booking->id)->where('status', $from)
            ->when($extra, $extra)
            ->update(array_merge($changes, ['status' => $to, 'updated_at' => now()]));
        if (!$updated) {
            throw new HttpException(409, $message);
        }
    }
}
