<?php

namespace App\Modules\LegacyBookings\Application;

use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\Location;
use App\Models\User;
use App\Modules\LegacyBookings\Contracts\BookingRequest;
use App\Modules\LegacyBookings\Contracts\BookingTypeHandler;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * The single writer for generic `bookings` rows (runbook §4 "Legacy booking
 * dispatcher"). Per-type rules come from BookingTypeHandler implementations
 * registered by their owning service; this class owns travel dates, capacity,
 * persistence and the audit entry.
 */
class BookingDispatcher
{
    /** @var array<string, BookingTypeHandler> */
    private array $handlers = [];

    /** @param iterable<BookingTypeHandler> $handlers */
    public function __construct(iterable $handlers)
    {
        foreach ($handlers as $handler) {
            $this->handlers[$handler->type()] = $handler;
        }
    }

    /** The caller's own bookings, newest first (passenger view, every role). */
    public function bookingsFor(User $user, ?string $status = null): Collection
    {
        $query = Booking::where('user_id', $user->id);

        if ($status !== null && $status !== '') {
            $query->where('status', $status);
        }

        return $query->orderBy('created_at', 'desc')->get();
    }

    /**
     * Create a pending booking. Price, service fee, title and location always
     * come from the booked item — client values are ignored.
     *
     * @throws BookingRejected
     */
    public function create(User $user, BookingRequest $request, string $paymentMethod, ?array $passengerNames): Booking
    {
        $handler = $this->handlers[$request->type] ?? throw new LogicException("No booking handler for type {$request->type}");

        $travelDate = self::normalizeTravelDate($request->travelDate);
        if ($travelDate === false) {
            throw new BookingRejected(422, 'Validation failed', 'Invalid or past travel date.');
        }

        return DB::transaction(function () use ($user, $request, $handler, $travelDate, $paymentMethod, $passengerNames) {
            $offer = $handler->offer($request);
            if (!$offer) {
                throw new BookingRejected(404, 'Item not found', 'This listing is no longer available.');
            }

            // Capacity: seats already held by non-cancelled bookings on the same item and date.
            $taken = (int) Booking::where('type', $request->type)
                ->where('reference_id', $request->referenceId)
                ->where('status', '!=', 'cancelled')
                ->where('travel_date', $travelDate)
                ->sum('quantity');
            if ($taken + $offer->quantity > $offer->capacity) {
                throw new BookingRejected(422, 'Sold out', 'Not enough seats left (' . max(0, $offer->capacity - $taken) . ' available).');
            }

            $locationId = $offer->originCity
                ? Location::where('city', $offer->originCity)->where('type', 'bus_station')->value('id')
                : null;

            $booking = Booking::create([
                'user_id'           => $user->id,
                'location_id'       => $locationId,
                'type'              => $request->type,
                'reference_id'      => $request->referenceId,
                'title'             => $offer->title,
                'sub'               => $offer->sub,
                'price'             => $offer->price,
                'service_fee'       => $offer->serviceFee,
                'quantity'          => $offer->quantity,
                'passenger_names'   => $passengerNames,
                'status'            => 'pending',
                'payment_method'    => $paymentMethod,
                'travel_date'       => $travelDate,
                'trip_id'           => null,
                'trip_departure_id' => $offer->tripDepartureId,
            ]);

            ActivityLog::create([
                'admin_id' => $user->id,
                'action' => 'booking_created',
                'entity_type' => 'booking',
                'entity_id' => $booking->id,
                'details' => [
                    'title' => $booking->title,
                    'type' => $booking->type,
                    'payment_method' => $booking->payment_method,
                ],
            ]);

            return $booking;
        });
    }

    /**
     * Accepts the labels the app sends ("Today", "Tomorrow", "Oct 7",
     * "Oct 7 · 14:00") or Y-m-d. Returns Y-m-d in Africa/Kigali, null when
     * absent, false when unparseable or in the past.
     */
    public static function normalizeTravelDate(?string $raw): string|null|false
    {
        if ($raw === null || trim($raw) === '') {
            return null;
        }
        $tz = 'Africa/Kigali';
        $today = Carbon::now($tz)->startOfDay();
        $label = trim(explode('·', $raw)[0]);
        $isIso = (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $label);

        try {
            $date = match (true) {
                strcasecmp($label, 'Today') === 0    => $today->copy(),
                strcasecmp($label, 'Tomorrow') === 0 => $today->copy()->addDay(),
                $isIso                               => Carbon::createFromFormat('Y-m-d', $label, $tz)->startOfDay(),
                default                              => Carbon::parse($label . ' ' . $today->year, $tz)->startOfDay(),
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
}
