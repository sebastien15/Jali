<?php

namespace App\Modules\DriverHire\Application;

use App\Models\DriverHire;
use App\Models\HireRating;
use App\Models\User;
use App\Modules\Providers\Contracts\ProviderDisplay;

/**
 * JSON shape of a hire for one viewer (contract schema "DriverHire").
 * Phone numbers are shared only while the hire is accepted or started.
 */
class HirePresenter
{
    public static function present(DriverHire $hire, User $viewer): array
    {
        $hire->loadMissing('driver.driverProfile', 'customer');
        $isCustomer = $hire->customer_id === $viewer->id;
        $booked = in_array($hire->status, DriverHire::BOOKED, true);
        $profile = $hire->driver->driverProfile;
        $service = app(HireService::class);
        $display = app(ProviderDisplay::class);

        return [
            'id'              => $hire->id,
            'role'            => $isCustomer ? 'customer' : 'driver',
            'status'          => $hire->status,
            'start_at'        => $hire->start_at->toIso8601String(),
            'end_at'          => $hire->end_at->toIso8601String(),
            'duration_type'   => $hire->duration_type,
            'duration_value'  => $hire->duration_value,
            'trip_type'       => $hire->trip_type,
            'transmission'    => $hire->transmission,
            'pickup'          => ['lat' => $hire->pickup_lat, 'lng' => $hire->pickup_lng, 'address' => $hire->pickup_address],
            'car_description' => $hire->car_description,
            'notes'           => $hire->notes,
            'driver_total'    => $hire->driver_total,
            'service_fee'     => $hire->service_fee,
            'quoted_total'    => $hire->quoted_total,
            'overtime_minutes'=> $hire->overtime_minutes,
            'overtime_amount' => $hire->overtime_amount,
            'final_total'     => $hire->final_total,
            'driver_earnings' => $isCustomer ? null : $service->driverEarnings($hire),
            'cancel_fee'      => $hire->cancel_fee,
            'cancel_fee_now'  => $isCustomer && in_array($hire->status, [DriverHire::REQUESTED, DriverHire::ACCEPTED], true) ? $service->cancelFee($hire) : null,
            'cancel_reason'   => $hire->cancel_reason,
            'payment_method'  => $hire->payment_method,
            'expires_at'      => $hire->status === DriverHire::REQUESTED ? $hire->expires_at?->toIso8601String() : null,
            'driver' => [
                'id'               => $hire->driver_id,
                'name'             => $display->displayName($hire->driver->name),
                'photo'            => preg_match('#^https?://#', (string) $hire->driver->profile_image_url) ? $hire->driver->profile_image_url : null,
                'rating'           => (float) ($profile?->rating_avg ?? 0),
                'years_experience' => $profile?->years_experience,
                'languages'        => $profile?->languages ?? [],
                'phone'            => $isCustomer && $booked ? $hire->driver->phone : null,
            ],
            'customer' => $isCustomer ? null : [
                'name'  => $display->displayName($hire->customer->name),
                'phone' => $booked ? $hire->customer->phone : null,
            ],
            'my_rating'      => HireRating::where(['driver_hire_id' => $hire->id, 'from_user_id' => $viewer->id])->value('stars'),
            'requested_at'   => $hire->requested_at?->toIso8601String(),
            'accepted_at'    => $hire->accepted_at?->toIso8601String(),
            'checked_in_at'  => $hire->checked_in_at?->toIso8601String(),
            'checked_out_at' => $hire->checked_out_at?->toIso8601String(),
            'cancelled_at'   => $hire->cancelled_at?->toIso8601String(),
            // S6.5: no-show reporting and hour disputes
            'no_show_from'   => $service->noShowFrom($hire)?->toIso8601String(),
            'can_dispute'    => $service->canDispute($hire, $viewer),
            'my_dispute'     => ($d = $hire->disputes()->where('user_id', $viewer->id)->latest('id')->first()) ? [
                'status' => $d->status, 'reason' => $d->reason, 'resolution' => $d->resolution,
                'created_at' => $d->created_at?->toIso8601String(),
            ] : null,
        ];
    }
}
