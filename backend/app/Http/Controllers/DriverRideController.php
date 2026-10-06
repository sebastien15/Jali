<?php

namespace App\Http\Controllers;

use App\Models\Ride;
use App\Modules\NearbyRides\Application\RidePresenter;
use App\Modules\NearbyRides\Application\RideQueries;
use App\Modules\NearbyRides\Application\RideService;
use Illuminate\Http\Request;

/**
 * Driver side of on-demand rides (stories S5.2, S4.1, S4.2, S4.4). Requires offer-rides.
 * Transport adapter for NearbyRides (runbook M03-Rides): validation + HTTP shape only.
 */
class DriverRideController extends Controller
{
    public function __construct(
        private readonly RideService $rides,
        private readonly RideQueries $queries,
    ) {
    }

    /** GET /driver/ride-requests — what this driver sees before accepting (no exact pickup, no phone) */
    public function requests(Request $request)
    {
        return response()->json($this->queries->driverRequests($request->user()));
    }

    public function accept(Request $request, int $id)
    {
        return $this->respond($request, $this->rides->accept($this->queries->offeredRide($request->user(), $id), $request->user()));
    }

    public function decline(Request $request, int $id)
    {
        return $this->respond($request, $this->rides->decline($this->queries->offeredRide($request->user(), $id), $request->user()));
    }

    public function arrive(Request $request, int $id)
    {
        return $this->respond($request, $this->rides->arrive($this->queries->assignedRide($request->user(), $id), $request->user()));
    }

    public function start(Request $request, int $id)
    {
        $validated = $request->validate(['pin' => ['required', 'string', 'regex:/^[0-9]{4}$/']]);

        return $this->respond($request, $this->rides->start($this->queries->assignedRide($request->user(), $id), $request->user(), $validated['pin']));
    }

    public function complete(Request $request, int $id)
    {
        $validated = $request->validate(['payment_method' => 'required|in:cash,momo']);

        return $this->respond($request, $this->rides->complete($this->queries->assignedRide($request->user(), $id), $request->user(), $validated['payment_method']));
    }

    private function respond(Request $request, Ride $ride)
    {
        return response()->json(RidePresenter::present($ride, $request->user()));
    }
}
