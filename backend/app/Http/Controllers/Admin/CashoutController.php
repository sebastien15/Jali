<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Payments\Application\PaymentRequestRejected;
use App\Modules\Payments\Application\StaffCashouts;
use Illuminate\Http\Request;

/** Transport adapter for Payments (M03-Remaining): validation + HTTP shape only. */
class CashoutController extends Controller
{
    public function __construct(private readonly StaffCashouts $cashouts)
    {
    }

    /** Get current cashout preference for the authenticated admin. */
    public function preference(Request $request)
    {
        return response()->json($this->cashouts->preference($request->user()));
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

        $this->cashouts->savePreference($request->user(), $data);

        return response()->json(['ok' => true]);
    }

    /** Submit a cashout request. */
    public function store(Request $request)
    {
        $user = $request->user();

        try {
            $this->cashouts->assertCanRequest($user);

            $request->validate([
                'amount' => 'required|numeric|min:1',
            ]);

            return response()->json($this->cashouts->request($user, $request->amount), 201);
        } catch (PaymentRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }

    /** List cashout requests for the authenticated admin. */
    public function index(Request $request)
    {
        return response()->json($this->cashouts->recent($request->user()));
    }
}
