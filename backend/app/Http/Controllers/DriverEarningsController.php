<?php

namespace App\Http\Controllers;

use App\Modules\Payments\Application\DriverEarnings;
use App\Modules\Payments\Application\PaymentRequestRejected;
use Illuminate\Http\Request;

/**
 * Driver money: earnings by period, what I owe Jali, settling by MoMo,
 * my MoMo details and payouts (stories S5.4, S7.1, S7.2). Requires offer-rides.
 * Transport adapter for Payments (M03-Remaining): validation + HTTP shape only.
 */
class DriverEarningsController extends Controller
{
    public function __construct(private readonly DriverEarnings $earnings)
    {
    }

    /** GET /driver/earnings */
    public function show(Request $request)
    {
        return response()->json($this->earnings->summary($request->user()));
    }

    /** POST /driver/settlements {amount, reference} — I paid Jali by MoMo; an admin confirms */
    public function settle(Request $request)
    {
        $data = $request->validate([
            'amount'    => 'required|integer|min:100|max:10000000',
            'reference' => 'required|string|min:4|max:100',
        ], ['reference.required' => 'Enter the MoMo transaction ID from your confirmation SMS.']);

        try {
            $settlement = $this->earnings->settle($request->user(), $data);
        } catch (PaymentRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }

        return response()->json(['id' => $settlement->id, 'status' => $settlement->status, 'message' => 'Thanks — we will confirm your payment soon.'], 201);
    }

    /** PUT /driver/momo {momo_number, momo_name} — riders who pay by MoMo see this (S7.1) */
    public function momo(Request $request)
    {
        $data = $request->validate([
            'momo_number' => ['required', 'string', 'regex:/^\+?[0-9 ]{9,15}$/'],
            'momo_name'   => 'required|string|max:100',
        ]);
        $this->earnings->saveMomo($request->user(), $data);

        return response()->json(['momo' => ['number' => $data['momo_number'], 'name' => $data['momo_name']]]);
    }

    /** POST /driver/payouts {amount} — only when Jali owes me (in-app payments) */
    public function payout(Request $request)
    {
        $data = $request->validate(['amount' => 'required|integer|min:1000']);
        $cashout = $this->earnings->payout($request->user(), $data['amount']);

        return response()->json(['id' => $cashout->id, 'status' => 'pending'], 201);
    }
}
