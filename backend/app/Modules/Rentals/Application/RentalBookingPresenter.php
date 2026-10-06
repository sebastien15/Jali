<?php

namespace App\Modules\Rentals\Application;

use App\Models\RentalBooking;
use App\Models\RentalRating;
use App\Models\User;

/**
 * A rental booking for its customer, its owner or an admin. Phone numbers are
 * shared only once the owner has accepted.
 */
class RentalBookingPresenter
{
    public static function for(RentalBooking $booking, User $viewer, string $as): array
    {
        $booking->loadMissing('car.owner', 'customer', 'owner');
        $car = $booking->car;
        $confirmed = in_array($booking->status, [RentalBooking::ACCEPTED, RentalBooking::ACTIVE, RentalBooking::COMPLETED], true);
        $ratings = RentalRating::where('rental_booking_id', $booking->id)->get();

        $data = [
            'id'               => $booking->id,
            'status'           => $booking->status,
            'start_at'         => $booking->start_at->toIso8601String(),
            'end_at'           => $booking->end_at->toIso8601String(),
            'days'             => (int) $booking->days,
            'pickup_method'    => $booking->pickup_method,
            'delivery_address' => $booking->delivery_address,
            'note'             => $booking->note,
            'payment_method'   => $booking->payment_method,
            'quote'            => $booking->quote,
            'terms'            => $booking->terms,
            'total'            => (int) $booking->total,
            'deposit'          => (int) $booking->deposit,
            'final_total'      => $booking->final_total,
            'extra_charges'    => $booking->extra_charges ?? [],
            'cancel_fee'       => (int) $booking->cancel_fee,
            'cancelled_by'     => $booking->cancelled_by,
            'cancel_reason'    => $booking->cancel_reason,
            'decline_reason'   => $booking->decline_reason,
            'handover'         => $booking->handover,
            'return_record'    => $booking->return_record,
            'requested_at'     => $booking->requested_at?->toIso8601String(),
            'expires_at'       => $booking->expires_at?->toIso8601String(),
            'accepted_at'      => $booking->accepted_at?->toIso8601String(),
            'handed_over_at'   => $booking->handed_over_at?->toIso8601String(),
            'returned_at'      => $booking->returned_at?->toIso8601String(),
            'cancelled_at'     => $booking->cancelled_at?->toIso8601String(),
            'car'              => $car ? [
                'id'             => $car->id,
                'name'           => $car->name,
                'type'           => $car->type,
                'plate'          => $confirmed || $as !== 'customer' ? $car->plate : null,
                'photo'          => ((array) $car->photos)[0] ?? null,
                'transmission'   => $car->transmission,
                'pickup_address' => $car->pickup_address,
                'pickup_lat'     => $confirmed || $as !== 'customer' ? $car->pickup_lat : null,
                'pickup_lng'     => $confirmed || $as !== 'customer' ? $car->pickup_lng : null,
            ] : null,
            'my_rating'        => optional($ratings->firstWhere('from_user_id', $viewer->id))->stars,
        ];

        if ($as === 'customer' || $as === 'admin') {
            $owner = $booking->owner;
            $data['owner'] = $owner ? [
                'name'  => $confirmed || $as === 'admin' ? $owner->name : (strtok((string) $owner->name, ' ') ?: 'Owner'),
                'phone' => $confirmed || $as === 'admin' ? $owner->phone : null,
            ] : null;
            $data['cancel_fee_now'] = RentalCancellation::customerFee($booking, now());
            $data['can_cancel'] = in_array($booking->status, [RentalBooking::REQUESTED, RentalBooking::ACCEPTED], true);
        }
        if ($as === 'owner' || $as === 'admin') {
            $customer = $booking->customer;
            $data['customer'] = $customer ? [
                'id'                => $customer->id,
                'name'              => $customer->name,
                'phone'             => $confirmed || $as === 'admin' ? $customer->phone : null,
                'completed_rentals' => RentalBooking::where('customer_id', $customer->id)->where('status', RentalBooking::COMPLETED)->count(),
                'rating'            => round((float) RentalRating::where('to_user_id', $customer->id)->avg('stars'), 1) ?: null,
            ] : null;
            $data['can_accept'] = $booking->status === RentalBooking::REQUESTED && $booking->expires_at?->isFuture();
            $data['can_handover'] = $booking->status === RentalBooking::ACCEPTED && now()->greaterThanOrEqualTo($booking->start_at->copy()->subHours(24));
            $data['can_return'] = $booking->status === RentalBooking::ACTIVE;
        }
        if ($as === 'admin') {
            $data['ratings'] = $ratings->map(fn (RentalRating $r) => [
                'from' => $r->from_user_id === $booking->customer_id ? 'customer' : 'owner',
                'stars' => $r->stars, 'comment' => $r->comment,
            ])->values();
        }

        return $data;
    }
}
