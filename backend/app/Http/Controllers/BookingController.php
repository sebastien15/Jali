<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\Bus;
use App\Models\CarRental;
use App\Models\Location;
use App\Models\PrivateSeat;
use App\Models\Trip;
use App\Models\TripDeparture;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

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
            // Driver: bookings for their private cars or rental cars
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
     * Create booking. Price, service fee, title and location are always
     * derived server-side from the booked item — client values are ignored.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            "type" => "required|in:bus,private,rental,trip",
            "reference_id" => "required|integer",
            "service_fee" => "nullable|integer|min:0",
            "payment_method" => "required|in:MTN MoMo,Airtel Money,Card",
            "travel_date" => "nullable|string|max:40",
            "quantity" => "nullable|integer|min:1|max:10",
            "days" => "nullable|integer|min:1|max:30",
            "passenger_names" => "nullable|array|max:10",
            "passenger_names.*" => "nullable|string|max:100",
        ]);

        $type = $validated["type"];
        $itemId = $validated["reference_id"];
        $quantity = $type === "rental" ? 1 : ($validated["quantity"] ?? 1);
        $days = $type === "rental" ? ($validated["days"] ?? 1) : 1;

        $travelDate = $this->normalizeTravelDate($validated["travel_date"] ?? null);
        if ($travelDate === false) {
            return response()->json(
                ["error" => "Validation failed", "message" => "Invalid or past travel date."],
                422,
            );
        }

        return DB::transaction(function () use ($user, $validated, $type, $itemId, $quantity, $days, $travelDate) {
            $item = match ($type) {
                "bus"     => Bus::lockForUpdate()->find($itemId),
                "private" => PrivateSeat::lockForUpdate()->find($itemId),
                "rental"  => CarRental::lockForUpdate()->find($itemId),
                "trip"    => TripDeparture::with(["route.agency", "route.fromStation", "route.toStation"])->lockForUpdate()->find($itemId),
            };

            $active = $item && ($type === "trip" ? ($item->active && $item->route->active) : ($item->active ?? true));
            if (!$active) {
                return response()->json(["error" => "Item not found", "message" => "This listing is no longer available."], 404);
            }

            // Capacity: seats already held by non-cancelled bookings on the same item and date.
            $capacity = match ($type) {
                "trip"   => (int) $item->route->total_seats,
                "rental" => 1,
                default  => (int) $item->seats,
            };
            $taken = (int) Booking::where("type", $type)
                ->where("reference_id", $itemId)
                ->where("status", "!=", "cancelled")
                ->where("travel_date", $travelDate)
                ->sum("quantity");
            if ($taken + $quantity > $capacity) {
                return response()->json(
                    ["error" => "Sold out", "message" => "Not enough seats left (" . max(0, $capacity - $taken) . " available)."],
                    422,
                );
            }

            $unitPrice = (int) ($type === "trip" ? $item->route->price : $item->price);
            $price = $unitPrice * $quantity * $days;
            $serviceFee = match ($type) {
                "trip"   => max(500, min(3000, (int) round($unitPrice * 0.05))),
                "rental" => 300,
                // bus/private: distance-based fee computed on the device (300–500 RWF tiers)
                default  => max(300, min(500, $validated["service_fee"] ?? 500)),
            };

            $title = match ($type) {
                "bus"     => "{$item->agency} · {$item->from} → {$item->to}",
                "private" => "{$item->driver} · {$item->from} → {$item->to}",
                "rental"  => "{$item->name} ({$item->type})",
                "trip"    => "{$item->route->agency->name} · {$item->route->fromStation->city} → {$item->route->toStation->city}",
            };
            $sub = match ($type) {
                "bus", "private" => "Departs {$item->dep}",
                "rental"         => "{$item->plate} · {$days} day" . ($days > 1 ? "s" : ""),
                "trip"           => "Departs " . substr($item->departure_time, 0, 5),
            };

            $fromCity = $type === "trip" ? $item->route->fromStation->city : ($item->from ?? null);
            $locationId = $fromCity
                ? Location::where("city", $fromCity)->where("type", "bus_station")->value("id")
                : null;

            $booking = Booking::create([
                "user_id"            => $user->id,
                "location_id"        => $locationId,
                "type"               => $type,
                "reference_id"       => $itemId,
                "title"              => $title,
                "sub"                => $sub,
                "price"              => $price,
                "service_fee"        => $serviceFee,
                "quantity"           => $quantity,
                "passenger_names"    => $validated["passenger_names"] ?? null,
                "status"             => "pending",
                "payment_method"     => $validated["payment_method"],
                "travel_date"        => $travelDate,
                "trip_id"            => null,
                "trip_departure_id"  => $type === "trip" ? $itemId : null,
            ]);

            ActivityLog::create([
                "admin_id" => $user->id,
                "action" => "booking_created",
                "entity_type" => "booking",
                "entity_id" => $booking->id,
                "details" => [
                    "title" => $booking->title,
                    "type" => $booking->type,
                    "payment_method" => $booking->payment_method,
                ],
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
        });
    }

    /**
     * Accepts the labels the app sends ("Today", "Tomorrow", "Oct 7",
     * "Oct 7 · 14:00") or Y-m-d. Returns Y-m-d in Africa/Kigali, null when
     * absent, false when unparseable or in the past.
     */
    private function normalizeTravelDate(?string $raw): string|null|false
    {
        if ($raw === null || trim($raw) === "") {
            return null;
        }
        $tz = "Africa/Kigali";
        $today = Carbon::now($tz)->startOfDay();
        $label = trim(explode("·", $raw)[0]);
        $isIso = (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $label);

        try {
            $date = match (true) {
                strcasecmp($label, "Today") === 0    => $today->copy(),
                strcasecmp($label, "Tomorrow") === 0 => $today->copy()->addDay(),
                $isIso                               => Carbon::createFromFormat("Y-m-d", $label, $tz)->startOfDay(),
                default                              => Carbon::parse($label . " " . $today->year, $tz)->startOfDay(),
            };
        } catch (\Throwable) {
            return false;
        }

        // "Jan 3" picked in late December means next year.
        if (!$isIso && $date->lt($today)) {
            $date->addYear();
        }
        if ($date->lt($today) || $date->gt($today->copy()->addYear())) {
            return false;
        }
        return $date->toDateString();
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
