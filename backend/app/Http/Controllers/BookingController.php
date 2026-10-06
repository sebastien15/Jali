<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Modules\LegacyBookings\Application\AdminBookingQueue;
use App\Modules\LegacyBookings\Application\BookingDispatcher;
use App\Modules\LegacyBookings\Application\BookingRejected;
use App\Modules\LegacyBookings\Application\BookingTransitionRefused;
use App\Modules\LegacyBookings\Contracts\BookingRequest;
use Illuminate\Http\Request;

class BookingController extends Controller
{
    public function __construct(
        private BookingDispatcher $bookings,
        private AdminBookingQueue $adminQueue,
    ) {
    }

    /**
     * List the caller's own bookings (passenger view, every role).
     * Admin queues live in /admin/bookings; driver passengers in /driver/trips.
     */
    public function index(Request $request)
    {
        $status = $request->filled("status") ? (string) $request->status : null;

        $trips = $this->bookings->bookingsFor($request->user(), $status)->map(fn ($booking) => [
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
     * derived server-side from the booked item — client values are ignored
     * (LegacyBookings dispatcher + per-type handlers).
     */
    public function store(Request $request)
    {
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

        try {
            $booking = $this->bookings->create(
                $request->user(),
                new BookingRequest(
                    type: $validated["type"],
                    referenceId: (int) $validated["reference_id"],
                    quantity: $validated["quantity"] ?? null,
                    days: $validated["days"] ?? null,
                    clientServiceFee: $validated["service_fee"] ?? null,
                    travelDate: $validated["travel_date"] ?? null,
                ),
                $validated["payment_method"],
                $validated["passenger_names"] ?? null,
            );
        } catch (BookingRejected $e) {
            return response()->json(["error" => $e->error, "message" => $e->getMessage()], $e->status);
        }

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
        return $this->moveTo($request, $id, "taken");
    }

    /**
     * Admin attaches the ticket photo URL → status: ticket_ready
     */
    public function uploadTicket(Request $request, $id)
    {
        $validated = $request->validate([
            "ticket_photo_url" => "required|url|max:2048",
        ]);

        return $this->moveTo($request, $id, "ticket_ready", $validated);
    }

    /**
     * Admin marks as delivered → status: delivered
     */
    public function deliver(Request $request, $id)
    {
        return $this->moveTo($request, $id, "delivered");
    }

    private function moveTo(Request $request, $id, string $status, array $extra = [])
    {
        $user = $request->user();
        $booking = $this->adminQueue->findManageableOrNull($user, $id);

        if (!$booking) {
            return response()->json(["error" => "Booking not found"], 404);
        }

        try {
            $this->adminQueue->transition($booking, $status, $user, $extra);
        } catch (BookingTransitionRefused $e) {
            return response()->json(
                ["error" => "Invalid status change", "message" => "Cannot change a {$e->current} booking to {$status}."],
                422,
            );
        }

        return response()->json([
            "status" => $status,
            "message" => "Booking updated.",
        ]);
    }
}
