<?php

namespace App\Modules\Payments\Application;

use App\Models\DriverHire;
use App\Models\Ride;
use App\Models\User;

/**
 * Receipt link and re-send for a customer's own finished rides and hires
 * (story S9.6). Other users get 404; an unfinished trip has no receipt yet.
 */
class TripReceipts
{
    /**
     * @return array{url: string, emailed: bool}
     * @throws PaymentRequestRejected
     */
    public function forRide(User $customer, int $id, bool $email): array
    {
        $ride = Ride::findOrFail($id);
        abort_unless($ride->rider_id === $customer->id, 404, 'Ride not found.');

        return $this->receipt('ride', $ride, in_array($ride->status, [Ride::COMPLETED, Ride::CANCELLED_BY_RIDER, Ride::CANCELLED_BY_DRIVER], true), $email);
    }

    /**
     * @return array{url: string, emailed: bool}
     * @throws PaymentRequestRejected
     */
    public function forHire(User $customer, int $id, bool $email): array
    {
        $hire = DriverHire::findOrFail($id);
        abort_unless($hire->customer_id === $customer->id, 404, 'Hire not found.');

        return $this->receipt('hire', $hire, in_array($hire->status, [DriverHire::COMPLETED, DriverHire::CANCELLED_BY_CUSTOMER, DriverHire::CANCELLED_BY_DRIVER], true), $email);
    }

    private function receipt(string $type, Ride|DriverHire $trip, bool $finished, bool $email): array
    {
        if (!$finished) {
            throw PaymentRequestRejected::message(409, 'A receipt is available once the trip is over.');
        }
        $emailed = $email ? Receipts::email($type, $trip) : false;

        return ['url' => Receipts::url($type, $trip->id), 'emailed' => $emailed];
    }
}
