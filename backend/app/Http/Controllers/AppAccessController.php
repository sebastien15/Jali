<?php

namespace App\Http\Controllers;

use App\Modules\Identity\Application\AppAccessLog;
use Illuminate\Http\Request;

/** Transport adapter for Identity (M03-Remaining): validation + HTTP shape only. */
class AppAccessController extends Controller
{
    public function __construct(private readonly AppAccessLog $accesses)
    {
    }

    public function store(Request $request)
    {
        $request->validate([
            'platform' => 'required|in:ios,android,web',
            'lat'      => 'nullable|numeric|between:-90,90',
            'lng'      => 'nullable|numeric|between:-180,180',
        ]);

        $this->accesses->record(
            $request->platform,
            // Public route: resolve the Sanctum user manually when a token is sent.
            auth('sanctum')->id(),
            $request->ip(),
            $request->lat,
            $request->lng,
            $request->filled('lat') && $request->filled('lng'),
        );

        return response()->json(['ok' => true]);
    }

    public function index(Request $request)
    {
        $filters = array_filter(
            ['platform' => 'platform', 'from_date' => 'from_date', 'to_date' => 'to_date'],
            fn ($key) => $request->filled($key),
        );
        $filters = array_map(fn ($key) => $request->input($key), $filters);
        $perPage = min((int) $request->get('per_page', 50), 200);

        return response()->json($this->accesses->page($filters, $perPage));
    }

    public function stats()
    {
        return response()->json($this->accesses->stats());
    }
}
