<?php

namespace App\Modules\Payments\Application;

use App\Mail\TripReceipt;
use App\Models\DriverHire;
use App\Models\Ride;
use App\Modules\Payments\Contracts\ReceiptMailer;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;

/** Trip receipts for rides and hires — email + printable page (story S9.6) */
class Receipts implements ReceiptMailer
{
    public const COMPANY = ['name' => 'Jali', 'address' => 'Kigali, Rwanda', 'email' => 'support@jali.rw', 'web' => 'https://jali.stoka.rw'];

    public static function forRide(Ride $ride): array
    {
        $ride->loadMissing('driver', 'vehicle', 'rider');

        return [
            'kind' => 'Ride', 'number' => 'R-' . $ride->id,
            'date' => ($ride->completed_at ?? $ride->requested_at)?->setTimezone('Africa/Kigali')->format('j M Y, H:i'),
            'customer' => $ride->rider?->name,
            'from' => $ride->pickup_address, 'to' => $ride->dropoff_address,
            'distance' => $ride->est_distance_km . ' km',
            'duration' => $ride->started_at && $ride->completed_at ? (int) $ride->started_at->diffInMinutes($ride->completed_at) . ' min' : $ride->est_minutes . ' min (est.)',
            'driver' => $ride->driver?->name, 'plate' => $ride->vehicle?->plate,
            'lines' => array_filter([
                ['Driver fare', $ride->driver_fare],
                ['Jali service fee', $ride->service_fee],
                $ride->cancel_fee ? ['Cancellation fee', $ride->cancel_fee] : null,
            ]),
            'total' => $ride->final_fare ?? ($ride->cancel_fee ?: $ride->quoted_fare),
            'payment' => $ride->payment_method === 'momo' ? 'MoMo' : 'Cash',
            'company' => self::COMPANY,
        ];
    }

    public static function forHire(DriverHire $hire): array
    {
        $hire->loadMissing('driver', 'customer');

        return [
            'kind' => 'Hire a driver', 'number' => 'H-' . $hire->id,
            'date' => $hire->start_at->copy()->setTimezone('Africa/Kigali')->format('j M Y, H:i'),
            'customer' => $hire->customer?->name,
            'from' => $hire->pickup_address, 'to' => $hire->car_description,
            'distance' => null,
            'duration' => $hire->duration_type === 'days' ? $hire->duration_value . ' day(s)' : $hire->duration_value . ' h',
            'driver' => $hire->driver?->name, 'plate' => null,
            'lines' => array_filter([
                ['Driver price', $hire->driver_total],
                $hire->overtime_amount ? ['Overtime (' . $hire->overtime_minutes . ' min)', $hire->overtime_amount] : null,
                ['Jali service fee', $hire->service_fee],
                $hire->cancel_fee ? ['Cancellation fee', $hire->cancel_fee] : null,
            ]),
            'total' => $hire->final_total ?? ($hire->cancel_fee ?: $hire->quoted_total),
            'payment' => $hire->payment_method === 'momo' ? 'MoMo' : 'Cash',
            'company' => self::COMPANY,
        ];
    }

    /** Printable page link valid for 30 days (save as PDF from the browser) */
    public static function url(string $type, int $id): string
    {
        return URL::temporarySignedRoute('receipt', now()->addDays(30), ['type' => $type, 'id' => $id]);
    }

    public function emailReceipt(string $type, Ride|DriverHire $trip): bool
    {
        return self::email($type, $trip);
    }

    /** Email the customer when they have an email address; never throws */
    public static function email(string $type, Ride|DriverHire $trip): bool
    {
        $customer = $trip instanceof Ride ? $trip->rider : $trip->customer;
        if (!$customer?->email) {
            return false;
        }
        try {
            $data = $trip instanceof Ride ? self::forRide($trip) : self::forHire($trip);
            Mail::to($customer->email)->send(new TripReceipt($data, self::url($type, $trip->id)));

            return true;
        } catch (\Throwable $e) {
            Log::warning('[Receipt] email failed: ' . $e->getMessage());

            return false;
        }
    }
}
