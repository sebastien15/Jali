<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Application\ActivityLogQueries;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Transport adapter for Identity (M03-Remaining): request parsing + HTTP shape only. */
class ActivityLogController extends Controller
{
    public function __construct(private readonly ActivityLogQueries $logs)
    {
    }

    public function index(Request $request)
    {
        // Each filter applies only when the parameter is present (even if empty), as before.
        $filters = [];
        foreach (["admin_id", "action", "entity_type", "from_date", "to_date"] as $key) {
            if ($request->has($key)) {
                $filters[$key] = $request->input($key);
            }
        }

        // Pagination (default 50)
        $perPage = min((int) $request->get("per_page", 50), 200);

        return response()->json($this->logs->page($filters, $perPage));
    }

    /** Returns which action group keys actually have log entries. */
    public function groups(): JsonResponse
    {
        return response()->json($this->logs->groups());
    }
}
