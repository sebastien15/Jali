<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Application\IdentityRequestRejected;
use App\Modules\Identity\Application\LocationChangeRequests;
use Illuminate\Http\Request;

/** Transport adapter for Identity (M03-Remaining): validation + HTTP shape only. */
class LocationChangeRequestController extends Controller
{
    public function __construct(private readonly LocationChangeRequests $requests)
    {
    }

    // Admin submits a location change request
    public function store(Request $request)
    {
        $data = $request->validate([
            "to_location_id" => "required|exists:locations,id",
            "reason" => "nullable|string|max:500",
        ]);

        try {
            return response()->json($this->requests->submit($request->user(), $data["to_location_id"]), 201);
        } catch (IdentityRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }

    // Superadmin lists all requests
    public function index(Request $request)
    {
        return response()->json($this->requests->list($request->has("status"), $request->input("status")));
    }

    // Superadmin approves
    public function approve(Request $request, $id)
    {
        try {
            $this->requests->approve($request->user(), $id);
        } catch (IdentityRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }

        return response()->json(["message" => "Location change approved."]);
    }

    // Superadmin rejects
    public function reject(Request $request, $id)
    {
        try {
            $this->requests->reject($request->user(), $id);
        } catch (IdentityRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }

        return response()->json(["message" => "Location change rejected."]);
    }
}
