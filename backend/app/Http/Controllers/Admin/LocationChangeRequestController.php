<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\ActivityLog;
use App\Models\LocationChangeRequest;
use Illuminate\Http\Request;

class LocationChangeRequestController extends Controller
{
    // Admin submits a location change request
    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            "to_location_id" => "required|exists:locations,id",
            "reason" => "nullable|string|max:500",
        ]);

        // Check for existing pending request
        $existing = LocationChangeRequest::where("admin_id", $user->id)
            ->where("status", "pending")
            ->first();
        if ($existing) {
            return response()->json(
                [
                    "error" =>
                        "You already have a pending location change request.",
                ],
                422,
            );
        }

        $request = LocationChangeRequest::create([
            "admin_id" => $user->id,
            "from_location_id" => $user->location_id,
            "to_location_id" => $data["to_location_id"],
            "status" => "pending",
        ]);

        return response()->json($request->load("toLocation"), 201);
    }

    // Superadmin lists all requests
    public function index(Request $request)
    {
        $query = LocationChangeRequest::with([
            "admin",
            "fromLocation",
            "toLocation",
        ]);

        if ($request->has("status")) {
            $query->where("status", $request->status);
        }

        $requests = $query->orderBy("created_at", "desc")->get();
        return response()->json($requests);
    }

    // Superadmin approves
    public function approve(Request $request, $id)
    {
        $superadmin = $request->user();
        $changeReq = LocationChangeRequest::with([
            "admin",
            "toLocation",
        ])->findOrFail($id);

        if ($changeReq->status !== "pending") {
            return response()->json(
                ["error" => "Request already processed."],
                422,
            );
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

        return response()->json(["message" => "Location change approved."]);
    }

    // Superadmin rejects
    public function reject(Request $request, $id)
    {
        $superadmin = $request->user();
        $changeReq = LocationChangeRequest::with("admin")->findOrFail($id);

        if ($changeReq->status !== "pending") {
            return response()->json(
                ["error" => "Request already processed."],
                422,
            );
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

        return response()->json(["message" => "Location change rejected."]);
    }
}
