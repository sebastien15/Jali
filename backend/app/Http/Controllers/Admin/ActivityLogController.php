<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        $query = ActivityLog::with("admin")->orderBy("created_at", "desc");

        // Filter by admin_id
        if ($request->has("admin_id")) {
            $query->where("admin_id", $request->admin_id);
        }

        // Filter by action type
        if ($request->has("action")) {
            $query->where("action", $request->action);
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
}
