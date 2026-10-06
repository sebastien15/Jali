<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Log;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        // Only what the log screen shows — not phone, Firebase uid or payout details.
        $query = ActivityLog::with("admin:id,name,email,role_id")->orderBy("created_at", "desc");

        // Filter by admin_id
        if ($request->has("admin_id")) {
            $query->where("admin_id", $request->admin_id);
        }

        // Filter by action type (accepts single or comma-separated values)
        if ($request->has("action")) {
            $actions = array_values(array_filter(explode(',', $request->action)));
            if (count($actions) === 1) {
                $query->where("action", $actions[0]);
            } elseif (count($actions) > 1) {
                $query->whereIn("action", $actions);
            }
        }

        // Filter by entity type
        if ($request->has("entity_type")) {
            $query->where("entity_type", $request->entity_type);
        }

        // Date range filter
        if ($request->has("from_date")) {
            $query->whereDate("created_at", ">=", $request->from_date);
        }
        if ($request->has("to_date")) {
            $query->whereDate("created_at", "<=", $request->to_date);
        }

        // Pagination (default 50)
        $perPage = min((int) $request->get("per_page", 50), 200);
        $logs = $query->paginate($perPage);

        return response()->json($logs);
    }

    /** Returns which action group keys actually have log entries. */
    public function groups(): JsonResponse
    {
        $existing = ActivityLog::distinct()->pluck('action')->all();
        return response()->json($existing);
    }
}
