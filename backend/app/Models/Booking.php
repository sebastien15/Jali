<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
    protected $fillable = [
        "user_id",
        "location_id",
        "trip_id",
        "trip_departure_id",
        "type",
        "reference_id",
        "title",
        "sub",
        "price",
        "service_fee",
        "status",
        "ticket_photo_url",
        "payment_method",
        "paid_at",
        "travel_date",
        "confirmed_by",
        "confirmed_at",
        "quantity",
        "passenger_names",
    ];

    protected function casts(): array
    {
        return [
            "paid_at" => "datetime",
            "confirmed_at" => "datetime",
            "passenger_names" => "array",
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(Trip::class);
    }

    public function confirmedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public function departure(): BelongsTo
    {
        return $this->belongsTo(TripDeparture::class, 'trip_departure_id');
    }

    /**
     * Allowed status changes. Anything not listed is rejected.
     */
    public const TRANSITIONS = [
        'pending'      => ['taken', 'cancelled'],
        'taken'        => ['ticket_ready', 'cancelled'],
        'ticket_ready' => ['ticket_ready', 'delivered'],
    ];

    private function notifyPassenger(): void
    {
        $message = match ($this->status) {
            'taken'        => ['Booking confirmed', "We're getting your ticket for {$this->title}."],
            'ticket_ready' => ['Your ticket is ready', "Tap to view your ticket for {$this->title}."],
            'cancelled'    => ['Booking cancelled', "Your booking for {$this->title} was cancelled."],
            default        => null,
        };
        $user = $this->user;
        if ($message && $user) {
            // Never let a slow or failed push delay or break the admin's request
            $id = $this->id;
            dispatch(fn () => app(\App\Modules\Notifications\Contracts\PushSender::class)->send($user, $message[0], $message[1], ['screen' => 'booking', 'id' => $id]))
                ->afterResponse();
        }
    }

    public function canTransitionTo(string $status): bool
    {
        return in_array($status, self::TRANSITIONS[$this->status] ?? [], true);
    }

    /**
     * Atomically move this booking from its current status to $status.
     * Returns false if the transition is illegal or another admin changed
     * the booking first (e.g. two admins claiming at the same time).
     */
    public function transitionTo(string $status, User $by, array $extra = []): bool
    {
        if (!$this->canTransitionTo($status)) {
            return false;
        }

        $changes = array_merge($extra, ['status' => $status, 'updated_at' => now()]);
        if ($status === 'taken') {
            $changes += ['confirmed_by' => $by->id, 'confirmed_at' => now()];
        }

        $updated = static::whereKey($this->id)
            ->where('status', $this->status)
            ->update($changes);

        if ($updated) {
            $this->refresh();
            $this->notifyPassenger();
        }
        return (bool) $updated;
    }

    /**
     * Bookings an admin may see/manage: superadmins see all; station admins
     * only bookings departing from their assigned station(s); admins without
     * a station see none. Rentals have no station, so only superadmins see them.
     */
    public function scopeManageableBy(Builder $query, User $user): Builder
    {
        if ($user->isSuperAdmin()) {
            return $query;
        }

        $stations = AdminStation::where('user_id', $user->id)->get(['id', 'city']);
        if ($stations->isEmpty()) {
            return $query->whereRaw('1 = 0');
        }

        $stationIds = $stations->pluck('id');
        $cities = $stations->pluck('city')->unique();

        return $query->where(function ($q) use ($stationIds, $cities) {
            $q->where(fn ($t) => $t->where('type', 'trip')
                    ->whereHas('departure.route', fn ($r) => $r->whereIn('from_station_id', $stationIds)))
              ->orWhere(fn ($t) => $t->whereIn('type', ['bus', 'private'])
                    ->whereHas('location', fn ($l) => $l->whereIn('city', $cities)));
        });
    }

    public function isManageableBy(User $user): bool
    {
        return static::whereKey($this->id)->manageableBy($user)->exists();
    }
}
