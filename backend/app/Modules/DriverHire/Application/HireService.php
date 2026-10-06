<?php

namespace App\Modules\DriverHire\Application;

use App\Models\DriverHire;
use App\Models\HireRating;
use App\Models\User;
use App\Modules\Payments\Contracts\MoneyRecorder;
use App\Modules\Payments\Contracts\ReceiptMailer;
use App\Modules\Pricing\Contracts\PricingPolicy;
use App\Modules\Providers\Contracts\ProviderReputation;
use App\Modules\Locations\Contracts\ServiceAreas;
use App\Modules\Notifications\Contracts\PushSender;
use App\Modules\ServiceAccess\Contracts\ServiceAccess;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Hire-a-driver lifecycle (stories S6.3, S6.4). Every transition is an atomic
 * conditional update, so two taps or two devices can't both win.
 */
class HireService
{
    public const CUSTOMER_CANCEL_REASONS = ['changed_plans', 'found_another_driver', 'driver_asked_to_cancel', 'booked_by_mistake', 'other'];
    public const DRIVER_CANCEL_REASONS = ['not_available', 'customer_asked_to_cancel', 'too_far', 'unsafe', 'other'];

    public function __construct(
        private PushSender $push,
        private PricingPolicy $pricing,
        private MoneyRecorder $money,
        private ReceiptMailer $receipts,
        private ProviderReputation $reputation,
        private ServiceAreas $areas,
    ) {
    }

    /** POST /driver-hire — price and end time are computed here, never taken from the client */
    public function request(User $customer, User $driver, array $data, CarbonInterface $start): DriverHire
    {
        app(ServiceAccess::class)->assertAcceptingNew('hire');   // S23.1
        // S10.4: only where hire is offered
        $where = $this->areas->availability((float) $data['pickup']['lat'], (float) $data['pickup']['lng'], 'hire');
        if (!$where['served']) {
            throw new HttpException(422, $where['message']);
        }
        $settings = $driver->hireSettings;
        $rate = $settings->snapshot();
        $quote = HireQuote::quote($rate, $data['duration_type'], (int) $data['duration_value'], $data['trip_type']);
        $end = HireQuote::endAt($start, $data['duration_type'], (int) $data['duration_value'], $settings->daily_hours);
        $hire = $this->pricing->hireSettings();

        if (!HireAvailability::isFree($driver->id, $start, $end)) {
            throw new HttpException(409, 'This driver is no longer free at that time. Choose another driver.');
        }
        // Customer can't hold two overlapping bookings
        $clash = DriverHire::where('customer_id', $customer->id)->whereIn('status', DriverHire::ACTIVE)
            ->where('start_at', '<', $end)->where('end_at', '>', $start)->exists();
        if ($clash) {
            throw new HttpException(409, 'You already have a driver booked for that time.');
        }

        $expires = now()->addMinutes((int) $hire['request_timeout_min']);
        $model = DriverHire::create([
            'customer_id'     => $customer->id,
            'driver_id'       => $driver->id,
            'status'          => DriverHire::REQUESTED,
            'start_at'        => $start,
            'end_at'          => $end,
            'duration_type'   => $data['duration_type'],
            'duration_value'  => (int) $data['duration_value'],
            'trip_type'       => $data['trip_type'],
            'transmission'    => $data['transmission'],
            'pickup_lat'      => $data['pickup']['lat'],
            'pickup_lng'      => $data['pickup']['lng'],
            'pickup_address'  => $data['pickup']['address'] ?? null,
            'car_description' => $data['car_description'] ?? null,
            'notes'           => $data['notes'] ?? null,
            'rate_snapshot'   => $rate,
            'driver_total'    => $quote['driver_total'],
            'service_fee'     => $quote['service_fee'],
            'quoted_total'    => $quote['total'],
            'commission_pct'  => $hire['commission_pct'],
            'payment_method'  => $data['payment_method'] ?? 'cash',
            'requested_at'    => now(),
            'expires_at'      => $expires->min($start),
        ]);

        $this->push->send($driver, 'New hire request',
            sprintf('%s · %s · you earn %s RWF', $start->copy()->setTimezone(HireAvailability::TZ)->format('D j M, H:i'),
                $this->durationLabel($model), number_format($this->driverEarnings($model))),
            ['screen' => 'driver_hire', 'id' => $model->id]);

        return $model->fresh();
    }

    public function accept(DriverHire $hire, User $driver): DriverHire
    {
        $this->expireIfLate($hire);
        // Re-check the calendar: another hire may have been accepted meanwhile (S6.2 → 409)
        if (HireAvailability::overlapsBooking($driver->id, $hire->start_at, $hire->end_at, $hire->id)) {
            throw new HttpException(409, 'You already accepted another hire at that time.');
        }
        $hire = $this->transition($hire, $driver, 'driver', [DriverHire::REQUESTED], ['status' => DriverHire::ACCEPTED, 'accepted_at' => now()],
            'This request is no longer open.');
        $this->push->send($hire->customer, 'Your driver is confirmed',
            sprintf('%s will drive your car on %s.', $driver->name, $hire->start_at->copy()->setTimezone(HireAvailability::TZ)->format('D j M, H:i')),
            ['screen' => 'hire', 'id' => $hire->id]);

        return $hire;
    }

    public function decline(DriverHire $hire, User $driver): DriverHire
    {
        $hire = $this->transition($hire, $driver, 'driver', [DriverHire::REQUESTED], ['status' => DriverHire::DECLINED],
            'This request is no longer open.');
        $this->push->send($hire->customer, 'Driver unavailable', 'Your driver can\'t make it. Choose another driver in one tap.',
            ['screen' => 'hire', 'id' => $hire->id]);

        return $hire;
    }

    /** Driver arrives and starts: allowed from 2 h before the start until the booked end */
    public function checkIn(DriverHire $hire, User $driver): DriverHire
    {
        if (now()->lt($hire->start_at->copy()->subHours(2)) || now()->gt($hire->end_at)) {
            throw new HttpException(409, 'You can check in from 2 hours before the start time.');
        }
        $hire = $this->transition($hire, $driver, 'driver', [DriverHire::ACCEPTED], ['status' => DriverHire::STARTED, 'checked_in_at' => now()],
            'This hire can\'t be started now.');
        $this->push->send($hire->customer, 'Your driver has started', 'Your hired driver checked in.', ['screen' => 'hire', 'id' => $hire->id]);

        return $hire;
    }

    /** Driver finishes: overtime is computed from the locked rate (S6.4) */
    public function checkOut(DriverHire $hire, User $driver, string $paymentMethod): DriverHire
    {
        $now = now();
        $overtime = HireQuote::overtime($hire->rate_snapshot, $hire->start_at, $hire->end_at, $hire->checked_in_at ?? $hire->start_at, $now);
        $driverPart = $hire->driver_total + $overtime['amount'];
        $hire = $this->transition($hire, $driver, 'driver', [DriverHire::STARTED], [
            'status'           => DriverHire::COMPLETED,
            'checked_out_at'   => $now,
            'overtime_minutes' => $overtime['minutes'],
            'overtime_amount'  => $overtime['amount'],
            'final_total'      => $hire->quoted_total + $overtime['amount'],
            'commission'       => (int) round($driverPart * $hire->commission_pct / 100),
            'payment_method'   => $paymentMethod,
        ], 'This hire is not in progress.');
        \App\Models\DriverProfile::where('user_id', $driver->id)->increment('trips_count');
        $this->money->recordHire($hire);   // S7.2
        $this->receipts->emailReceipt('hire', $hire);   // S9.6

        $this->push->send($hire->customer, 'Hire completed',
            sprintf('Total %s RWF%s. Tap to rate your driver.', number_format($hire->final_total),
                $hire->overtime_minutes ? sprintf(' (incl. %d min overtime)', $hire->overtime_minutes) : ''),
            ['screen' => 'hire', 'id' => $hire->id]);

        return $hire;
    }

    /** Customer: free while requested or until free_cancel_hours before the start, then a fee. Driver: free until started. */
    public function cancel(DriverHire $hire, User $user, string $reason): DriverHire
    {
        $isCustomer = $hire->customer_id === $user->id;
        $allowed = $isCustomer ? [DriverHire::REQUESTED, DriverHire::ACCEPTED] : [DriverHire::ACCEPTED];
        $fee = $isCustomer ? $this->cancelFee($hire) : 0;

        $hire = $this->transition($hire, $user, $isCustomer ? 'customer' : 'driver', $allowed, [
            'status'        => $isCustomer ? DriverHire::CANCELLED_BY_CUSTOMER : DriverHire::CANCELLED_BY_DRIVER,
            'cancelled_at'  => now(),
            'cancelled_by'  => $isCustomer ? 'customer' : 'driver',
            'cancel_reason' => $reason,
            'cancel_fee'    => $fee,
        ], 'This hire can no longer be cancelled.');

        $other = $isCustomer ? $hire->driver : $hire->customer;
        $this->push->send($other, $isCustomer ? 'Hire cancelled by the customer' : 'Your driver cancelled',
            $isCustomer ? 'Your time is free again.' : 'Sorry — choose another driver in one tap.',
            ['screen' => $isCustomer ? 'driver_hire' : 'hire', 'id' => $hire->id]);

        return $hire;
    }

    /** S6.5: when a no-show can be reported (start + grace), or null when not applicable */
    public function noShowFrom(DriverHire $hire): ?\Carbon\CarbonInterface
    {
        return $hire->status === DriverHire::ACCEPTED
            ? $hire->start_at->copy()->addMinutes((int) $this->pricing->hireSettings()['no_show_grace_min'])
            : null;
    }

    /**
     * S6.5: the other side didn't show. The customer reporting ends the hire with no fee;
     * the driver reporting ends it with the late-cancellation fee owed to the driver.
     */
    public function reportNoShow(DriverHire $hire, User $user): DriverHire
    {
        $from = $this->noShowFrom($hire);
        if (!$from) {
            throw new HttpException(409, 'A no-show can only be reported on an accepted hire that has not started.');
        }
        if (now()->lt($from)) {
            throw new HttpException(409, sprintf('You can report a no-show from %s.', $from->copy()->setTimezone('Africa/Kigali')->format('H:i')));
        }
        $byCustomer = $hire->customer_id === $user->id;
        $fee = $byCustomer ? 0 : (int) round($hire->driver_total * (int) $this->pricing->hireSettings()['late_cancel_pct'] / 100);

        $hire = $this->transition($hire, $user, $byCustomer ? 'customer' : 'driver', [DriverHire::ACCEPTED], [
            'status'        => $byCustomer ? DriverHire::NO_SHOW_DRIVER : DriverHire::NO_SHOW_CUSTOMER,
            'cancelled_at'  => now(),
            'cancelled_by'  => $byCustomer ? 'customer' : 'driver',
            'cancel_reason' => 'no_show',
            'cancel_fee'    => $fee,
        ], 'This hire is no longer waiting to start.');

        $other = $byCustomer ? $hire->driver : $hire->customer;
        $this->push->send($other, 'No-show reported',
            $byCustomer ? 'The customer reported that you did not come. Contact Jali support if this is wrong.'
                : sprintf('Your driver reported that you did not show. A fee of %s RWF applies; contact Jali support if this is wrong.', number_format($fee)),
            ['screen' => $byCustomer ? 'driver_hire' : 'hire', 'id' => $hire->id]);

        return $hire;
    }

    /** S6.5: can this user dispute the recorded hours now? */
    public function canDispute(DriverHire $hire, User $user): bool
    {
        return $hire->status === DriverHire::COMPLETED && $hire->checked_out_at
            && $hire->checked_out_at->copy()->addDays((int) $this->pricing->hireSettings()['dispute_days'])->isFuture()
            && !$hire->disputes()->where('user_id', $user->id)->where('status', \App\Models\HireDispute::OPEN)->exists();
    }

    public function dispute(DriverHire $hire, User $user, string $reason, ?string $claimedEnd): \App\Models\HireDispute
    {
        if (!$this->canDispute($hire, $user)) {
            throw new HttpException(409, 'Hours can be disputed once, within a few days of a completed hire.');
        }
        $byCustomer = $hire->customer_id === $user->id;

        return $hire->disputes()->create([
            'user_id' => $user->id, 'role' => $byCustomer ? 'customer' : 'driver',
            'reason' => $reason, 'claimed_end' => $claimedEnd, 'status' => \App\Models\HireDispute::OPEN,
        ]);
    }

    /** Cancel reasons the user may give for this hire: customer or driver list */
    public function cancelReasons(DriverHire $hire, User $user): array
    {
        return $hire->customer_id === $user->id ? self::CUSTOMER_CANCEL_REASONS : self::DRIVER_CANCEL_REASONS;
    }

    /** Fee the customer owes if they cancel now (0 = free) */
    public function cancelFee(DriverHire $hire): int
    {
        if ($hire->status !== DriverHire::ACCEPTED) {
            return 0;
        }
        $settings = $this->pricing->hireSettings();
        if (now()->lt($hire->start_at->copy()->subHours((int) $settings['free_cancel_hours']))) {
            return 0;
        }

        return HireQuote::roundUp($hire->driver_total * $settings['late_cancel_pct'] / 100);
    }

    public function rate(DriverHire $hire, User $user, int $stars, array $tags = [], ?string $comment = null): HireRating
    {
        if ($hire->status !== DriverHire::COMPLETED) {
            throw new HttpException(409, 'You can rate once the hire is completed.');
        }
        if (HireRating::where(['driver_hire_id' => $hire->id, 'from_user_id' => $user->id])->exists()) {
            throw new HttpException(409, 'You already rated this hire.');
        }
        $to = $hire->customer_id === $user->id ? $hire->driver_id : $hire->customer_id;

        return DB::transaction(function () use ($hire, $user, $to, $stars, $tags, $comment) {
            $rating = HireRating::create([
                'driver_hire_id' => $hire->id, 'from_user_id' => $user->id, 'to_user_id' => $to,
                'stars' => $stars, 'tags' => $tags ?: null, 'comment' => $comment,
            ]);
            if ($to === $hire->driver_id) {
                $this->reputation->refreshProviderRating($to);
            }

            return $rating;
        });
    }

    /** Unanswered requests expire after the timeout or at the start time */
    public function expire(DriverHire $hire): bool
    {
        $done = DriverHire::whereKey($hire->id)->where('status', DriverHire::REQUESTED)
            ->update(['status' => DriverHire::EXPIRED, 'updated_at' => now()]);
        if ($done) {
            $this->push->send($hire->customer, 'No answer from the driver', 'Your hire request expired. Choose another driver.',
                ['screen' => 'hire', 'id' => $hire->id]);
        }

        return (bool) $done;
    }

    /** Expire every overdue request (all drivers, or one driver's); returns how many expired */
    public function expireOverdue(?int $driverId = null): int
    {
        $count = 0;
        DriverHire::where('status', DriverHire::REQUESTED)->where('expires_at', '<', now())
            ->when($driverId, fn ($q) => $q->where('driver_id', $driverId))
            ->each(function (DriverHire $hire) use (&$count) {
                $count += (int) $this->expire($hire);
            });

        return $count;
    }

    public function expireIfLate(DriverHire $hire): bool
    {
        if ($hire->status === DriverHire::REQUESTED && $hire->expires_at && $hire->expires_at->isPast()) {
            $this->expire($hire);
            $hire->refresh();

            return true;
        }

        return false;
    }

    public function driverEarnings(DriverHire $hire): int
    {
        $driverPart = $hire->driver_total + $hire->overtime_amount;

        return $driverPart - ($hire->commission ?? (int) round($driverPart * $hire->commission_pct / 100));
    }

    private function durationLabel(DriverHire $hire): string
    {
        return $hire->duration_type === 'days'
            ? $hire->duration_value . ' day' . ($hire->duration_value > 1 ? 's' : '')
            : $hire->duration_value . ' h';
    }

    private function transition(DriverHire $hire, User $actor, string $as, array $from, array $changes, string $conflict): DriverHire
    {
        $owner = $as === 'customer' ? $hire->customer_id : $hire->driver_id;
        if ($owner !== $actor->id) {
            throw new HttpException(404, 'Hire not found.');
        }
        $won = DriverHire::whereKey($hire->id)->whereIn('status', $from)->update($changes + ['updated_at' => now()]);
        if (!$won) {
            throw new HttpException(409, $conflict);
        }

        return $hire->fresh();
    }
}
