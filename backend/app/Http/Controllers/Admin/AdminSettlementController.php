<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Payments\Application\PaymentRequestRejected;
use App\Modules\Payments\Application\SettlementReview;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admins confirm drivers' MoMo commission payments (story S7.2). Requires manage-rides.
 * Transport adapter for Payments (M03-Remaining): permission check, validation + HTTP shape only.
 */
class AdminSettlementController extends Controller
{
    public function __construct(private readonly SettlementReview $settlements)
    {
    }

    /** GET /admin/settlements?status=pending */
    public function index(Request $request)
    {
        $this->authorizeOps($request);
        $status = $request->validate(['status' => ['sometimes', Rule::in(['pending', 'confirmed', 'rejected'])]])['status'] ?? 'pending';

        return response()->json($this->settlements->list($status));
    }

    /** POST /admin/settlements/{id}/confirm — credits the driver's ledger */
    public function confirm(Request $request, int $id)
    {
        $admin = $this->authorizeOps($request);

        try {
            return response()->json($this->settlements->confirm($admin, $id));
        } catch (PaymentRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }

    /** POST /admin/settlements/{id}/reject {note} */
    public function reject(Request $request, int $id)
    {
        $admin = $this->authorizeOps($request);
        $note = $request->validate(['note' => 'required|string|min:3|max:255'])['note'];

        try {
            return response()->json($this->settlements->reject($admin, $id, $note));
        } catch (PaymentRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }

    private function authorizeOps(Request $request)
    {
        $user = $request->user();
        abort_unless($user->hasPermission('manage-rides'), 403, 'You do not have permission to manage rides.');

        return $user;
    }
}
