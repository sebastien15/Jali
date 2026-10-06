<?php

namespace App\Modules\Identity\Application;

use App\Models\ActivityLog;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * The admin audit log reader (/admin/logs, manage-admins). Entries are still
 * written by each owning module through App\Models\ActivityLog; this is only
 * the staff-facing query and exposes just what the log screen shows.
 */
class ActivityLogQueries
{
    /**
     * @param array{admin_id?: mixed, action?: string, entity_type?: mixed, from_date?: mixed, to_date?: mixed} $filters
     *        only keys present in the request are passed
     */
    public function page(array $filters, int $perPage): LengthAwarePaginator
    {
        // Only what the log screen shows — not phone, Firebase uid or payout details.
        $query = ActivityLog::with("admin:id,name,email,role_id")->orderBy("created_at", "desc");

        // Filter by admin_id
        if (array_key_exists("admin_id", $filters)) {
            $query->where("admin_id", $filters["admin_id"]);
        }

        // Filter by action type (accepts single or comma-separated values)
        if (array_key_exists("action", $filters)) {
            $actions = array_values(array_filter(explode(',', (string) $filters["action"])));
            if (count($actions) === 1) {
                $query->where("action", $actions[0]);
            } elseif (count($actions) > 1) {
                $query->whereIn("action", $actions);
            }
        }

        // Filter by entity type
        if (array_key_exists("entity_type", $filters)) {
            $query->where("entity_type", $filters["entity_type"]);
        }

        // Date range filter
        if (array_key_exists("from_date", $filters)) {
            $query->whereDate("created_at", ">=", $filters["from_date"]);
        }
        if (array_key_exists("to_date", $filters)) {
            $query->whereDate("created_at", "<=", $filters["to_date"]);
        }

        return $query->paginate($perPage);
    }

    /** Which action keys actually have log entries. */
    public function groups(): array
    {
        return ActivityLog::distinct()->pluck('action')->all();
    }
}
