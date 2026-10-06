<?php

namespace App\Modules\Payments\Contracts;

use App\Models\DriverHire;
use App\Models\Ride;

/**
 * Email a completed job's receipt to its customer (story S9.6).
 * Type is 'ride' or 'hire'. Never throws: returns false when the customer has
 * no email or sending failed, so a mail problem never fails the job.
 */
interface ReceiptMailer
{
    public function emailReceipt(string $type, Ride|DriverHire $trip): bool;
}
