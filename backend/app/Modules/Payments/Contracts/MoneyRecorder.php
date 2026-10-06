<?php

namespace App\Modules\Payments\Contracts;

use App\Models\DriverHire;
use App\Models\Ride;

/**
 * What a service calls when a job completes, so Payments records the
 * provider's earning and what they owe Jali.
 *
 * Source type/id are stable ('ride'/ride id, 'hire'/hire id). Recording the
 * same completed job again is a no-op (unique source_type+source_id+type on
 * driver_ledger); this is retry-safe for sequential calls only and is not an
 * exactly-once guarantee under concurrency.
 */
interface MoneyRecorder
{
    public function recordRide(Ride $ride): void;

    public function recordHire(DriverHire $hire): void;

    /**
     * Manual correction of a provider's balance (e.g. an admin lowers a ride's commission).
     * $effect > 0 credits the provider; 0 writes nothing. Not de-duplicated: each call is a new entry.
     */
    public function adjust(int $userId, string $sourceType, ?int $sourceId, int $effect, string $note): void;
}
