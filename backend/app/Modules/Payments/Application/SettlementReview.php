<?php

namespace App\Modules\Payments\Application;

use App\Models\ActivityLog;
use App\Models\DriverSettlement;
use App\Models\User;
use App\Modules\Notifications\Contracts\PushSender;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Admins confirm or reject drivers' MoMo commission payments (story S7.2,
 * /admin/settlements/**). Each settlement is reviewed once (conditional
 * update); a confirmation credits the driver's ledger in the same transaction.
 * The transport checks manage-rides and validates input.
 */
class SettlementReview
{
    public function __construct(
        private readonly DriverLedger $ledger,
        private readonly PushSender $push,
    ) {
    }

    public function list(string $status): Collection
    {
        return DriverSettlement::with('user')->where('status', $status)->orderBy('id')->limit(200)->get()->map(fn ($s) => [
            'id' => $s->id, 'driver' => ['id' => $s->user_id, 'name' => $s->user?->name, 'phone' => $s->user?->phone],
            'amount' => $s->amount, 'reference' => $s->reference, 'status' => $s->status,
            'owed' => DriverLedger::owed($s->user_id), 'at' => $s->created_at?->toIso8601String(),
        ])->values();
    }

    /** @throws PaymentRequestRejected already reviewed */
    public function confirm(User $admin, int $id): array
    {
        $settlement = DriverSettlement::findOrFail($id);

        $done = DB::transaction(function () use ($settlement, $admin) {
            $won = DriverSettlement::whereKey($settlement->id)->where('status', 'pending')
                ->update(['status' => 'confirmed', 'reviewed_by' => $admin->id, 'reviewed_at' => now(), 'updated_at' => now()]);
            if ($won) {
                $this->ledger->settlement($settlement->user_id, $settlement->id, $settlement->amount);
                $this->log($admin->id, 'settlement.confirmed', $settlement);
            }

            return $won;
        });
        if (!$done) {
            throw PaymentRequestRejected::message(409, 'This settlement was already reviewed.');
        }
        $this->push->send($settlement->user, 'Payment confirmed', sprintf('We received your %s RWF. Thank you!', number_format($settlement->amount)),
            ['screen' => 'driver_earnings']);

        return ['id' => $settlement->id, 'status' => 'confirmed', 'owed' => DriverLedger::owed($settlement->user_id)];
    }

    /** @throws PaymentRequestRejected already reviewed */
    public function reject(User $admin, int $id, string $note): array
    {
        $settlement = DriverSettlement::findOrFail($id);

        $won = DriverSettlement::whereKey($settlement->id)->where('status', 'pending')
            ->update(['status' => 'rejected', 'note' => $note, 'reviewed_by' => $admin->id, 'reviewed_at' => now(), 'updated_at' => now()]);
        if (!$won) {
            throw PaymentRequestRejected::message(409, 'This settlement was already reviewed.');
        }
        $this->log($admin->id, 'settlement.rejected', $settlement, ['note' => $note]);
        $this->push->send($settlement->user, 'Payment not found', $note, ['screen' => 'driver_earnings']);

        return ['id' => $settlement->id, 'status' => 'rejected'];
    }

    private function log(int $adminId, string $action, DriverSettlement $s, array $extra = []): void
    {
        ActivityLog::create(['admin_id' => $adminId, 'action' => $action, 'entity_type' => 'driver_settlement', 'entity_id' => $s->id,
            'details' => ['driver_id' => $s->user_id, 'amount' => $s->amount, 'reference' => $s->reference] + $extra]);
    }
}
