<?php

namespace App\Http\Controllers;

use App\Models\DriverHire;
use App\Models\Ride;
use App\Modules\Payments\Application\Receipts;
use Illuminate\Http\Request;

/** Receipt link and re-send for my rides and hires (story S9.6) */
class ReceiptController extends Controller
{
    /** POST /rides/{id}/receipt {email?: bool} */
    public function ride(Request $request, int $id)
    {
        $ride = Ride::findOrFail($id);
        abort_unless($ride->rider_id === $request->user()->id, 404, 'Ride not found.');

        return $this->respond($request, 'ride', $ride, in_array($ride->status, [Ride::COMPLETED, Ride::CANCELLED_BY_RIDER, Ride::CANCELLED_BY_DRIVER], true));
    }

    /** POST /driver-hire/{id}/receipt {email?: bool} */
    public function hire(Request $request, int $id)
    {
        $hire = DriverHire::findOrFail($id);
        abort_unless($hire->customer_id === $request->user()->id, 404, 'Hire not found.');

        return $this->respond($request, 'hire', $hire, in_array($hire->status, [DriverHire::COMPLETED, DriverHire::CANCELLED_BY_CUSTOMER, DriverHire::CANCELLED_BY_DRIVER], true));
    }

    private function respond(Request $request, string $type, Ride|DriverHire $trip, bool $finished)
    {
        if (!$finished) {
            return response()->json(['message' => 'A receipt is available once the trip is over.'], 409);
        }
        $emailed = $request->boolean('email') ? Receipts::email($type, $trip) : false;

        return response()->json(['url' => Receipts::url($type, $trip->id), 'emailed' => $emailed]);
    }
}
