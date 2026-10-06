<?php

namespace App\Modules\Identity\Application;

use App\Models\ActivityLog;
use App\Models\LocationChangeRequest;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * An admin asks to move to another pickup location (users.location_id); a
 * superadmin (manage-admins) approves or rejects. One pending request per admin.
 * Input is validated by the transport.
 */
class LocationChangeRequests
{
    /** @throws IdentityRequestRejected */
    public function submit(User $admin, int|string $toLocationId): LocationChangeRequest
    {
        // Check for existing pending request
        $existing = LocationChangeRequest::where("admin_id", $admin->id)
            ->where("status", "pending")
            ->first();
        if ($existing) {
            throw IdentityRequestRejected::error(422, "You already have a pending location change request.");
        }

        $request = LocationChangeRequest::create([
            "admin_id" => $admin->id,
            "from_location_id" => $admin->location_id,
            "to_location_id" => $toLocationId,
            "status" => "pending",
        ]);

        return $request->load("toLocation");
    }

    /** $status is applied only when the request carried a status parameter. */
    public function list(bool $filterByStatus, mixed $status): Collection
    {
        $query = LocationChangeRequest::with([
            "admin",
            "fromLocation",
            "toLocation",
        ]);

        if ($filterByStatus) {
            $query->where("status", $status);
        }

        return $query->orderBy("created_at", "desc")->get();
    }

    /** @throws IdentityRequestRejected */
    public function approve(User $superadmin, int|string $id): void
    {
        $changeReq = LocationChangeRequest::with([
            "admin",
            "toLocation",
        ])->findOrFail($id);

        if ($changeReq->status !== "pending") {
            throw IdentityRequestRejected::error(422, "Request already processed.");
        }

        DB::transaction(function () use ($changeReq, $superadmin) {
            $changeReq->update([
                "status" => "approved",
                "superadmin_id" => $superadmin->id,
                "approved_at" => now(),
            ]);

            // Update admin's location
            $changeReq->admin->forceFill([
                "location_id" => $changeReq->to_location_id,
            ])->save();
        });

        ActivityLog::create([
            "admin_id" => $superadmin->id,
            "action" => "location_change_approved",
            "entity_type" => "location_change_request",
            "entity_id" => $changeReq->id,
            "details" => [
                "admin" => $changeReq->admin->name,
                "new_location" => $changeReq->toLocation->name,
            ],
        ]);
    }

    /** @throws IdentityRequestRejected */
    public function reject(User $superadmin, int|string $id): void
    {
        $changeReq = LocationChangeRequest::with("admin")->findOrFail($id);

        if ($changeReq->status !== "pending") {
            throw IdentityRequestRejected::error(422, "Request already processed.");
        }

        $changeReq->update([
            "status" => "rejected",
            "superadmin_id" => $superadmin->id,
            "approved_at" => now(),
        ]);

        ActivityLog::create([
            "admin_id" => $superadmin->id,
            "action" => "location_change_rejected",
            "entity_type" => "location_change_request",
            "entity_id" => $changeReq->id,
            "details" => ["admin" => $changeReq->admin->name],
        ]);
    }
}
