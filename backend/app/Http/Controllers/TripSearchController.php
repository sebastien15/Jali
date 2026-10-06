<?php

namespace App\Http\Controllers;

use App\Modules\Bus\Application\BusCatalogue;
use Illuminate\Http\Request;

/** Transport adapter for Bus (runbook M03-Bus): validation + HTTP shape only. */
class TripSearchController extends Controller
{
    public function __construct(private readonly BusCatalogue $catalogue)
    {
    }

    /**
     * Return active agency routes grouped with their departure times.
     * Each route has a `departures` array — one card per agency on the user side.
     */
    public function index(Request $request)
    {
        $request->validate([
            'from_station_id' => 'nullable|exists:admin_stations,id',
            'to_station_id'   => 'nullable|exists:admin_stations,id',
            'agency_id'       => 'nullable|exists:agencies,id',
        ]);

        return response()->json($this->catalogue->trips(
            $request->filled('from_station_id') ? (string) $request->from_station_id : null,
            $request->filled('to_station_id') ? (string) $request->to_station_id : null,
            $request->filled('agency_id') ? (string) $request->agency_id : null,
        ));
    }
}
