<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CashoutRequest;
use App\Modules\Payments\Contracts\StaffEarnings;
use Illuminate\Http\Request;

class CashoutController extends Controller
{
    /** Get current cashout preference for the authenticated admin. */
    public function preference(Request $request)
    {
        $user = $request->user();
        return response()->json([
            'cashout_method'         => $user->cashout_method,
            'cashout_account_number' => $user->cashout_account_number,
            'cashout_account_name'   => $user->cashout_account_name,
            'cashout_bank_name'      => $user->cashout_bank_name,
        ]);
    }

    /** Save cashout preference. */
    public function savePreference(Request $request)
    {
        $data = $request->validate([
            'cashout_method'         => 'required|in:bank,mobile',
            'cashout_account_number' => 'required|string|max:50',
            'cashout_account_name'   => 'nullable|string|max:100',
            'cashout_bank_name'      => 'nullable|string|max:100',
        ]);

        $request->user()->update($data);

        return response()->json(['ok' => true]);
    }

    /** Submit a cashout request. */
    public function store(Request $request)
    {
        $user = $request->user();

        if (!$user->cashout_method || !$user->cashout_account_number) {
            return response()->json(['message' => 'Set your cashout method first.'], 422);
        }

        $request->validate([
            'amount' => 'required|numeric|min:1',
        ]);

        $available = app(StaffEarnings::class)->availableFor($user);
        if ($request->amount > $available) {
            return response()->json([
                'message'   => 'Amount exceeds your available balance (' . number_format($available) . ' RWF).',
                'available' => $available,
            ], 422);
        }

        $cashout = CashoutRequest::create([
            'admin_id'       => $user->id,
            'amount'         => $request->amount,
            'method'         => $user->cashout_method,
            'account_number' => $user->cashout_account_number,
            'account_name'   => $user->cashout_account_name,
            'bank_name'      => $user->cashout_bank_name,
            'status'         => 'pending',
        ]);

        return response()->json($cashout, 201);
    }

    /** List cashout requests for the authenticated admin. */
    public function index(Request $request)
    {
        $requests = CashoutRequest::where('admin_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json($requests);
    }
}
