<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\NearbyRides\Application\AdminRides;
use App\Modules\NearbyRides\Application\RideNotAdjustable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Ride operations for admins (stories S10.1, S10.2). Requires manage-rides.
 * Transport adapter for NearbyRides (runbook M03-Rides): permission, validation + HTTP shape only.
 */
class AdminRideController extends Controller
{
    public function __construct(private readonly AdminRides $rides)
    {
    }

    /** GET /admin/rides/live — online drivers, active rides and counters (S10.1) */
    public function live(Request $request)
    {
        $this->authorizeOps($request);

        return response()->json($this->rides->live());
    }

    /** GET /admin/rides?status&from&to&rider&driver&flagged&page (S10.2) */
    public function index(Request $request)
    {
        $this->authorizeOps($request);
        $filters = $request->validate([
            'status'  => ['sometimes', Rule::in(AdminRides::STATUSES)],
            'from'    => ['sometimes', 'date'],
            'to'      => ['sometimes', 'date'],
            'rider'   => ['sometimes', 'string', 'max:100'],
            'driver'  => ['sometimes', 'string', 'max:100'],
            'flagged' => ['sometimes', 'boolean'],
        ]);

        return response()->json($this->rides->search($filters));
    }

    /** GET /admin/rides/{id} — timeline, fare breakdown, ratings (S10.2) */
    public function show(Request $request, int $id)
    {
        $this->authorizeOps($request);

        return response()->json($this->rides->detail($this->rides->ride($id)));
    }

    /** POST /admin/rides/{id}/adjust {final_fare?, commission?, note} — completed rides only, logged */
    public function adjust(Request $request, int $id)
    {
        $admin = $this->authorizeOps($request);
        $ride = $this->rides->ride($id);
        $data = $request->validate([
            'final_fare' => ['nullable', 'integer', 'min:0', 'max:10000000'],
            'commission' => ['nullable', 'integer', 'min:0', 'max:10000000'],
            'note'       => ['required', 'string', 'min:5', 'max:500'],
        ]);

        try {
            return response()->json($this->rides->adjust($ride, $admin, $data));
        } catch (RideNotAdjustable $e) {
            return response()->json(['message' => $e->getMessage()], 409);
        }
    }

    private function authorizeOps(Request $request): User
    {
        $user = $request->user();
        abort_unless($user && $user->hasPermission('manage-rides'), 403, 'You do not have permission to manage rides.');

        return $user;
    }
}
