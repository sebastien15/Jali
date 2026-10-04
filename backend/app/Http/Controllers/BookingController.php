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
     * List the caller's own bookings (passenger view, every role).
     * Admin queues live in /admin/bookings; driver passengers in /driver/trips.
     */
    public function index(Request $request)
    {
        $query = Booking::where("user_id", $request->user()->id);

        if ($request->filled("status")) {
            $query->where("status", $request->status);
        }

        $trips = $query->orderBy("created_at", "desc")->get()->map(fn ($booking) => [
            "id" => $booking->id,
            "type" => $booking->type,
            "title" => $booking->title,
            "sub" => $booking->sub,
            "price" => $booking->price + $booking->service_fee,
            "quantity" => $booking->quantity ?? 1,
            "travel_date" => $booking->travel_date,
            "status" => $booking->status,
            "ticket_photo_url" => $booking->ticket_photo_url,
            "location_id" => $booking->location_id,
            "created_at" => $booking->created_at,
        ]);

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

            $active = $item && ($type === "trip" ? ($item->active && $item->route->active) : ($item->active ?? true))
                && ($type !== "rental" || ($item->status ?? "available") === "available");
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

        $isOwner = (int) $booking->user_id === (int) $user->id;
        if (!$isOwner && !($user->hasPermission("confirm-bookings") && $booking->isManageableBy($user))) {
            return response()->json(["error" => "Forbidden"], 403);
        }

        return response()->json([
            "id" => $booking->id,
            "type" => $booking->type,
            "title" => $booking->title,
            "sub" => $booking->sub,
            "price" => $booking->price + $booking->service_fee,
            "quantity" => $booking->quantity ?? 1,
            "travel_date" => $booking->travel_date,
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
        return $this->moveTo($request, $id, "taken", "booking_claimed");
    }

    /**
     * Admin attaches the ticket photo URL → status: ticket_ready
     */
    public function uploadTicket(Request $request, $id)
    {
        $validated = $request->validate([
            "ticket_photo_url" => "required|url|max:2048",
        ]);

        return $this->moveTo($request, $id, "ticket_ready", "ticket_uploaded", $validated);
    }

    /**
     * Admin marks as delivered → status: delivered
     */
    public function deliver(Request $request, $id)
    {
        return $this->moveTo($request, $id, "delivered", "booking_delivered");
    }

    private function moveTo(Request $request, $id, string $status, string $action, array $extra = [])
    {
        $user = $request->user();
        $booking = Booking::find($id);

        if (!$booking || !$booking->isManageableBy($user)) {
            return response()->json(["error" => "Booking not found"], 404);
        }

        $from = $booking->status;
        if (!$booking->transitionTo($status, $user, $extra)) {
            return response()->json(
                ["error" => "Invalid status change", "message" => "Cannot change a {$booking->fresh()->status} booking to {$status}."],
                422,
            );
        }

        ActivityLog::create([
            "admin_id" => $user->id,
            "action" => $action,
            "entity_type" => "booking",
            "entity_id" => $booking->id,
            "details" => ["title" => $booking->title, "from" => $from, "to" => $status],
        ]);

        return response()->json([
            "status" => $status,
            "message" => "Booking updated.",
        ]);
    }
}
