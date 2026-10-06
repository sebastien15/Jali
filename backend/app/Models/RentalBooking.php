<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A date-range car rental (stories S24.2–S24.6). Quote and terms are locked at request time. */
class RentalBooking extends Model
{
    public const REQUESTED = 'requested';
    public const ACCEPTED = 'accepted';
    public const ACTIVE = 'active';          // car handed over
    public const COMPLETED = 'completed';    // car returned
    public const DECLINED = 'declined';
    public const EXPIRED = 'expired';
    public const CANCELLED = 'cancelled';

    /** Statuses that hold the car's dates */
    public const HOLDING = [self::REQUESTED, self::ACCEPTED, self::ACTIVE];
    public const OPEN = [self::REQUESTED, self::ACCEPTED, self::ACTIVE];

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'quote'          => 'array',
            'terms'          => 'array',
            'extra_charges'  => 'array',
            'handover'       => 'array',
            'return_record'  => 'array',
            'start_at'       => 'datetime',
            'end_at'         => 'datetime',
            'requested_at'   => 'datetime',
            'expires_at'     => 'datetime',
            'accepted_at'    => 'datetime',
            'handed_over_at' => 'datetime',
            'returned_at'    => 'datetime',
            'cancelled_at'   => 'datetime',
        ];
    }

    public function car(): BelongsTo
    {
        return $this->belongsTo(CarRental::class, 'car_rental_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(RentalRating::class);
    }
}
