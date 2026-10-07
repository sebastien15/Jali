<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A booking of a driver for the customer's own car (stories S6.3, S6.4).
 *
 *   requested ──accept──▶ accepted ──check-in──▶ started ──check-out──▶ completed
 *       │ decline / expire     │ cancel (customer: fee when late; driver)
 *       ▼                      ▼
 *   declined / expired     cancelled_by_customer / cancelled_by_driver
 */
class DriverHire extends Model
{
    public const REQUESTED = 'requested';
    public const ACCEPTED = 'accepted';
    public const STARTED = 'started';
    public const COMPLETED = 'completed';
    public const DECLINED = 'declined';
    public const EXPIRED = 'expired';
    public const CANCELLED_BY_CUSTOMER = 'cancelled_by_customer';
    public const CANCELLED_BY_DRIVER = 'cancelled_by_driver';
    /** S6.5: the driver didn't come (reported by the customer) / the customer didn't show (reported by the driver) */
    public const NO_SHOW_DRIVER = 'no_show_driver';
    public const NO_SHOW_CUSTOMER = 'no_show_customer';

    public const ACTIVE = [self::REQUESTED, self::ACCEPTED, self::STARTED];
    /** Statuses that hold the driver's time */
    public const BOOKED = [self::ACCEPTED, self::STARTED];

    public const TRIP_TYPES = ['city', 'out_of_town', 'airport'];
    public const TRANSMISSIONS = ['automatic', 'manual'];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'start_at' => 'datetime', 'end_at' => 'datetime', 'requested_at' => 'datetime', 'expires_at' => 'datetime',
            'accepted_at' => 'datetime', 'checked_in_at' => 'datetime', 'checked_out_at' => 'datetime', 'cancelled_at' => 'datetime',
            'with_car' => 'boolean',
            'pickup_lat' => 'float', 'pickup_lng' => 'float', 'commission_pct' => 'float', 'rate_snapshot' => 'array',
            'duration_value' => 'integer',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(HireRating::class);
    }

    /** S13.7: the driver's car, for hires with a car */
    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function disputes(): HasMany
    {
        return $this->hasMany(HireDispute::class);
    }

    public function involves(User $user): bool
    {
        return $this->customer_id === $user->id || $this->driver_id === $user->id;
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE, true);
    }
}
