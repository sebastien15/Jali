<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\DriverSettlement;
use App\Modules\Payments\Application\DriverLedger;
use App\Services\PushService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** Admins confirm drivers' MoMo commission payments (story S7.2). Requires manage-rides. */
class AdminSettlementController extends Controller
{
    /** GET /admin/settlements?status=pending */
    public function index(Request $request)
    {
        $this->authorizeOps($request);
        $status = $request->validate(['status' => ['sometimes', Rule::in(['pending', 'confirmed', 'rejected'])]])['status'] ?? 'pending';

        return response()->json(DriverSettlement::with('user')->where('status', $status)->orderBy('id')->limit(200)->get()->map(fn ($s) => [
            'id' => $s->id, 'driver' => ['id' => $s->user_id, 'name' => $s->user?->name, 'phone' => $s->user?->phone],
            'amount' => $s->amount, 'reference' => $s->reference, 'status' => $s->status,
            'owed' => DriverLedger::owed($s->user_id), 'at' => $s->created_at?->toIso8601String(),
        ])->values());
    }

    /** POST /admin/settlements/{id}/confirm — credits the driver's ledger */
    public function confirm(Request $request, DriverLedger $ledger, PushService $push, int $id)
    {
        $admin = $this->authorizeOps($request);
        $settlement = DriverSettlement::findOrFail($id);

        $done = DB::transaction(function () use ($settlement, $admin, $ledger) {
            $won = DriverSettlement::whereKey($settlement->id)->where('status', 'pending')
                ->update(['status' => 'confirmed', 'reviewed_by' => $admin->id, 'reviewed_at' => now(), 'updated_at' => now()]);
            if ($won) {
                $ledger->settlement($settlement->user_id, $settlement->id, $settlement->amount);
                $this->log($admin->id, 'settlement.confirmed', $settlement);
            }

            return $won;
        });
        if (!$done) {
            return response()->json(['message' => 'This settlement was already reviewed.'], 409);
        }
        $push->send($settlement->user, 'Payment confirmed', sprintf('We received your %s RWF. Thank you!', number_format($settlement->amount)),
            ['screen' => 'driver_earnings']);

        return response()->json(['id' => $settlement->id, 'status' => 'confirmed', 'owed' => DriverLedger::owed($settlement->user_id)]);
    }

    /** POST /admin/settlements/{id}/reject {note} */
    public function reject(Request $request, PushService $push, int $id)
    {
        $admin = $this->authorizeOps($request);
        $note = $request->validate(['note' => 'required|string|min:3|max:255'])['note'];
        $settlement = DriverSettlement::findOrFail($id);

        $won = DriverSettlement::whereKey($settlement->id)->where('status', 'pending')
            ->update(['status' => 'rejected', 'note' => $note, 'reviewed_by' => $admin->id, 'reviewed_at' => now(), 'updated_at' => now()]);
        if (!$won) {
            return response()->json(['message' => 'This settlement was already reviewed.'], 409);
        }
        $this->log($admin->id, 'settlement.rejected', $settlement, ['note' => $note]);
        $push->send($settlement->user, 'Payment not found', $note, ['screen' => 'driver_earnings']);

        return response()->json(['id' => $settlement->id, 'status' => 'rejected']);
    }

    private function authorizeOps(Request $request)
    {
        $user = $request->user();
        abort_unless($user->hasPermission('manage-rides'), 403, 'You do not have permission to manage rides.');

        return $user;
    }

    private function log(int $adminId, string $action, DriverSettlement $s, array $extra = []): void
    {
        ActivityLog::create(['admin_id' => $adminId, 'action' => $action, 'entity_type' => 'driver_settlement', 'entity_id' => $s->id,
            'details' => ['driver_id' => $s->user_id, 'amount' => $s->amount, 'reference' => $s->reference] + $extra]);
    }
}
