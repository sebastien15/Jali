<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\NearbyRides\Application\RideAnalytics;
use Illuminate\Http\Request;

/**
 * Ride metrics for the analytics screen (story S10.3). Requires view-analytics.
 * Transport adapter for NearbyRides (runbook M03-Rides): permission, validation + HTTP shape only.
 */
class RideAnalyticsController extends Controller
{
    public function __construct(private readonly RideAnalytics $analytics)
    {
    }

    /** GET /analytics/rides?period=day|week&from&to */
    public function index(Request $request)
    {
        $user = $request->user();
        abort_unless($user && $user->hasPermission('view-analytics'), 403, 'You do not have permission to view analytics.');

        $data = $request->validate([
            'period' => ['sometimes', 'in:day,week'],
            'from'   => ['sometimes', 'date'],
            'to'     => ['sometimes', 'date'],
        ]);

        return response()->json($this->analytics->report($data));
    }
}
