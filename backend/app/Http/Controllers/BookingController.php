<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\Bus;
use App\Models\CarRental;
use App\Models\Location;
use App\Models\PrivateSeat;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    /**
     * List bookings — users see own, admins see location-scoped
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Booking::query();

        if ($user->isAdmin() && !$user->isSuperAdmin()) {
            // Admin: only bookings for their location
            if ($user->location_id) {
                $query->where("location_id", $user->location_id);
            } else {
                return response()->json([]);
            }
        } elseif ($user->isDriver()) {
            // Driver: bookings for their private seats or rental cars
            $privateSeatIds = PrivateSeat::where("user_id", $user->id)->pluck(
                "id",
            );
            $carRentalIds = CarRental::where("user_id", $user->id)->pluck("id");

            $query->where(function ($q) use ($privateSeatIds, $carRentalIds) {
                if ($privateSeatIds->isNotEmpty()) {
                    $q->orWhere(function ($sq) use ($privateSeatIds) {
                        $sq->where("type", "private")->whereIn(
                            "reference_id",
                            $privateSeatIds,
                        );
                    });
                }
                if ($carRentalIds->isNotEmpty()) {
                    $q->orWhere(function ($sq) use ($carRentalIds) {
                        $sq->where("type", "rental")->whereIn(
                            "reference_id",
                            $carRentalIds,
                        );
                    });
                }
            });
        } else {
            // Regular user: only own bookings
            $query->where("user_id", $user->id);
        }

        if ($request->has("status")) {
            $query->where("status", $request->status);
        }

        $bookings = $query->with("user")->orderBy("created_at", "desc")->get();

        $trips = $bookings->map(function ($booking) {
            return [
                "id" => $booking->id,
                "type" => $booking->type,
                "title" => $booking->title,
                "sub" => $booking->sub,
                "price" => $booking->price + $booking->service_fee,
                "status" => $booking->status,
                "ticket_photo_url" => $booking->ticket_photo_url,
                "location_id" => $booking->location_id,
            ];
        });

        return response()->json($trips);
    }

    /**
     * Create booking — accepts location_id, sets status=pending
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            "type" => "required|in:bus,private,rental",
            "reference_id" => "required|integer",
            "price" => "required|integer|min:0",
            "service_fee" => "required|integer|min:0",
            "payment_method" => "required|string",
            "title" => "nullable|string",
            "sub" => "nullable|string",
            "travel_date" => "nullable|string",
            "location_id" => "nullable|exists:locations,id",
        ]);

        $type = $validated["type"];
        $itemId = $validated["reference_id"];

        // Server-side title/sub generation
        if (empty($validated["title"])) {
            $item = match ($type) {
                "bus" => Bus::find($itemId),
                "private" => PrivateSeat::find($itemId),
                "rental" => CarRental::find($itemId),
            };

            if (!$item) {
                return response()->json(["error" => "Item not found"], 404);
            }

            $validated["title"] = match ($type) {
                "bus" => "{$item->agency} · {$item->from} → {$item->to}",
                "private" => "{$item->driver} · {$item->from} → {$item->to}",
                "rental" => "{$item->name} ({$item->type})",
            };
            $validated["sub"] = match ($type) {
                "bus" => "Departs {$item->dep} · {$item->seats} seats",
                "private" => "Departs {$item->dep}",
                "rental" => "{$item->plate} · {$item->seats} seats",
            };
        }

        // Auto-assign location from route city if not provided
        if (empty($validated["location_id"]) && isset($item)) {
            $location = Location::where("city", $item->from)
                ->where("type", "bus_station")
                ->first();
            if ($location) {
                $validated["location_id"] = $location->id;
            }
        }

        $booking = Booking::create([
            "user_id" => $user->id,
            "location_id" => $validated["location_id"] ?? null,
            "type" => $type,
            "reference_id" => $itemId,
            "title" => $validated["title"],
            "sub" => $validated["sub"] ?? "",
            "price" => $validated["price"],
            "service_fee" => $validated["service_fee"],
            "status" => "pending",
            "payment_method" => $validated["payment_method"],
            "travel_date" => $validated["travel_date"] ?? null,
        ]);

        return response()->json(
            [
                "id" => $booking->id,
                "type" => $booking->type,
                "title" => $booking->title,
                "sub" => $booking->sub,
                "price" => $booking->price + $booking->service_fee,
                "status" => $booking->status,
            ],
            201,
        );
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        $booking = Booking::findOrFail($id);

        if ($booking->user_id !== $user->id && !$user->isAdmin()) {
            return response()->json(["error" => "Forbidden"], 403);
        }

        return response()->json([
            "id" => $booking->id,
            "type" => $booking->type,
            "title" => $booking->title,
            "sub" => $booking->sub,
            "price" => $booking->price + $booking->service_fee,
            "status" => $booking->status,
            "ticket_photo_url" => $booking->ticket_photo_url,
            "location_id" => $booking->location_id,
        ]);
    }

    /**
     * Admin claims a pending booking → status: taken
     */
    public function claim(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json(["error" => "Forbidden"], 403);
        }

        // Location scoping
        if (!$user->isSuperAdmin() && $user->location_id) {
            $booking = Booking::where("id", $id)
                ->where("location_id", $user->location_id)
                ->first();
        } else {
            $booking = Booking::find($id);
        }

        if (!$booking) {
            return response()->json(["error" => "Booking not found"], 404);
        }
        if ($booking->status !== "pending") {
            return response()->json(
                ["error" => "Booking already claimed."],
                422,
            );
        }

        $booking->update(["status" => "taken"]);

        ActivityLog::create([
            "admin_id" => $user->id,
            "action" => "booking_claimed",
            "entity_type" => "booking",
            "entity_id" => $booking->id,
            "details" => ["title" => $booking->title],
        ]);

        return response()->json([
            "status" => "taken",
            "message" => "Booking claimed.",
        ]);
    }

    /**
     * Admin uploads ticket photo → status: ticket_ready
     */
    public function uploadTicket(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json(["error" => "Forbidden"], 403);
        }

        $validated = $request->validate([
            "ticket_photo_url" => "required|string",
        ]);

        $booking = Booking::findOrFail($id);

        if ($booking->status !== "taken") {
            return response()->json(
                [
                    "error" =>
                        'Booking must be in "taken" status to upload ticket.',
                ],
                422,
            );
        }

        $booking->update([
            "status" => "ticket_ready",
            "ticket_photo_url" => $validated["ticket_photo_url"],
        ]);

        ActivityLog::create([
            "admin_id" => $user->id,
            "action" => "ticket_uploaded",
            "entity_type" => "booking",
            "entity_id" => $booking->id,
            "details" => ["title" => $booking->title],
        ]);

        return response()->json([
            "status" => "ticket_ready",
            "message" => "Ticket uploaded.",
        ]);
    }

    /**
     * Admin marks as delivered → status: delivered
     */
    public function deliver(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json(["error" => "Forbidden"], 403);
        }

        $booking = Booking::findOrFail($id);

        if ($booking->status !== "ticket_ready") {
            return response()->json(
                [
                    "error" =>
                        'Booking must be in "ticket_ready" status to deliver.',
                ],
                422,
            );
        }

        $booking->update(["status" => "delivered"]);

        ActivityLog::create([
            "admin_id" => $user->id,
            "action" => "booking_delivered",
            "entity_type" => "booking",
            "entity_id" => $booking->id,
            "details" => ["title" => $booking->title],
        ]);

        return response()->json([
            "status" => "delivered",
            "message" => "Booking delivered.",
        ]);
    }
}
