<?php

namespace App\Modules\Payments\Application;

use App\Models\DriverHire;
use App\Models\DriverLedgerEntry;
use App\Models\Ride;
use App\Modules\Payments\Contracts\MoneyRecorder;
use App\Modules\Payments\Contracts\ProviderDebtLimit;
use App\Modules\Pricing\Contracts\PricingPolicy;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Driver money (stories S7.1, S7.2, S5.4).
 *
 * At launch riders pay drivers directly (cash or MoMo), so a completed trip
 * records the driver's net earning (no balance change — they already hold the
 * money) and what they owe Jali: commission + Jali's service fee.
 * Settlements and adjustments move the balance back.
 */
class DriverLedger implements MoneyRecorder, ProviderDebtLimit
{
    public static function balance(int $userId): int
    {
        return (int) (DriverLedgerEntry::where('user_id', $userId)->orderByDesc('id')->value('balance_after') ?? 0);
    }

    /** What the driver owes Jali right now (0 when Jali owes them) */
    public static function owed(int $userId): int
    {
        return max(0, -self::balance($userId));
    }

    public static function overLimit(int $userId): bool
    {
        return self::owed($userId) > (int) app(PricingPolicy::class)->settings()['max_commission_owed'];
    }

    public function isOverLimit(int $userId): bool
    {
        return self::overLimit($userId);
    }

    public function recordRide(Ride $ride): void
    {
        if ($ride->status !== Ride::COMPLETED || !$ride->driver_id) {
            return;
        }
        $commission = (int) $ride->commission;
        $this->write($ride->driver_id, 'ride', $ride->id, 'earning', $ride->driver_fare - $commission, 0,
            sprintf('Ride #%d (%s)', $ride->id, $ride->payment_method ?? 'cash'));
        $owed = $commission + $ride->service_fee;
        $this->write($ride->driver_id, 'ride', $ride->id, 'commission', $owed, -$owed,
            sprintf('Commission %d + Jali fee %d', $commission, $ride->service_fee));
    }

    public function recordHire(DriverHire $hire): void
    {
        if ($hire->status !== DriverHire::COMPLETED) {
            return;
        }
        $commission = (int) $hire->commission;
        $driverPart = $hire->driver_total + $hire->overtime_amount;
        $this->write($hire->driver_id, 'hire', $hire->id, 'earning', $driverPart - $commission, 0,
            sprintf('Hire #%d (%s)', $hire->id, $hire->payment_method ?? 'cash'));
        $owed = $commission + $hire->service_fee;
        $this->write($hire->driver_id, 'hire', $hire->id, 'commission', $owed, -$owed,
            sprintf('Commission %d + Jali fee %d', $commission, $hire->service_fee));
    }

    /** Positive effect = less owed by the driver */
    public function adjust(int $userId, string $sourceType, ?int $sourceId, int $effect, string $note): void
    {
        if ($effect === 0) {
            return;
        }
        $this->write($userId, $sourceType, $sourceId, 'adjustment', abs($effect), $effect, $note, unique: false);
    }

    public function settlement(int $userId, int $settlementId, int $amount): void
    {
        $this->write($userId, 'settlement', $settlementId, 'settlement', $amount, $amount, 'MoMo settlement confirmed');
    }

    public function payout(int $userId, int $cashoutId, int $amount): void
    {
        $this->write($userId, 'payout', $cashoutId, 'payout', $amount, -$amount, 'Payout to MoMo');
    }

    private function write(int $userId, string $sourceType, ?int $sourceId, string $type, int $amount, int $effect, string $note, bool $unique = true): void
    {
        try {
            DB::transaction(function () use ($userId, $sourceType, $sourceId, $type, $amount, $effect, $note, $unique) {
                // Lock the driver's last row so concurrent writes keep a correct running balance
                $last = DriverLedgerEntry::where('user_id', $userId)->orderByDesc('id')->lockForUpdate()->value('balance_after') ?? 0;
                DriverLedgerEntry::create([
                    'user_id' => $userId, 'source_type' => $sourceType,
                    'source_id' => $unique ? $sourceId : null,   // adjustments are not unique per source
                    'type' => $type, 'amount' => $amount, 'balance_effect' => $effect,
                    'balance_after' => $last + $effect, 'note' => $unique ? $note : $note . ($sourceId ? " (#$sourceId)" : ''),
                ]);
            });
        } catch (QueryException $e) {
            // Unique (source_type, source_id, type): this trip is already on the ledger
            if (!str_contains(strtolower($e->getMessage()), 'unique')) {
                throw $e;
            }
        }
    }
}
