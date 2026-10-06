<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ride extends Model
{
    public const REQUESTED = 'requested';
    public const ACCEPTED = 'accepted';
    public const ARRIVED = 'arrived';
    public const IN_PROGRESS = 'in_progress';
    public const COMPLETED = 'completed';
    public const DECLINED = 'declined';
    public const EXPIRED = 'expired';
    public const CANCELLED_BY_RIDER = 'cancelled_by_rider';
    public const CANCELLED_BY_DRIVER = 'cancelled_by_driver';

    /** Statuses where the rider or the driver is busy with this ride. */
    public const ACTIVE = [self::REQUESTED, self::ACCEPTED, self::ARRIVED, self::IN_PROGRESS];
    /** Statuses where the driver is assigned and on the way or driving. */
    public const ONGOING = [self::ACCEPTED, self::ARRIVED, self::IN_PROGRESS];

    protected $guarded = ['id'];

    protected $hidden = ['start_pin', 'share_token'];

    protected function casts(): array
    {
        return [
            'pickup_lat'      => 'float',
            'pickup_lng'      => 'float',
            'dropoff_lat'     => 'float',
            'dropoff_lng'     => 'float',
            'est_distance_km' => 'float',
            'pickup_km'       => 'float',
            'commission_pct'  => 'float',
            'rate_snapshot'   => 'array',
            'requested_at'    => 'datetime',
            'expires_at'      => 'datetime',
            'accepted_at'     => 'datetime',
            'arrived_at'      => 'datetime',
            'started_at'      => 'datetime',
            'completed_at'    => 'datetime',
            'cancelled_at'    => 'datetime',
            'flagged_at'      => 'datetime',
            'sos_at'          => 'datetime',
        ];
    }

    public function rider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rider_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(RideEvent::class)->orderBy('id');
    }

    public function dispatches(): HasMany
    {
        return $this->hasMany(RideDispatch::class);
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(RideRating::class);
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE, true);
    }

    public function involves(User $user): bool
    {
        return $this->rider_id === $user->id || ($this->driver_id && $this->driver_id === $user->id);
    }
}
