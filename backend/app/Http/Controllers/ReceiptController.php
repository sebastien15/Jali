<?php

namespace App\Http\Controllers;

use App\Modules\Payments\Application\PaymentRequestRejected;
use App\Modules\Payments\Application\TripReceipts;
use Illuminate\Http\Request;

/**
 * Receipt link and re-send for my rides and hires (story S9.6).
 * Transport adapter for Payments (M03-Remaining): HTTP shape only.
 */
class ReceiptController extends Controller
{
    public function __construct(private readonly TripReceipts $receipts)
    {
    }

    /** POST /rides/{id}/receipt {email?: bool} */
    public function ride(Request $request, int $id)
    {
        return $this->respond(fn () => $this->receipts->forRide($request->user(), $id, $request->boolean('email')));
    }

    /** POST /driver-hire/{id}/receipt {email?: bool} */
    public function hire(Request $request, int $id)
    {
        return $this->respond(fn () => $this->receipts->forHire($request->user(), $id, $request->boolean('email')));
    }

    private function respond(callable $receipt)
    {
        try {
            return response()->json($receipt());
        } catch (PaymentRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }
}
