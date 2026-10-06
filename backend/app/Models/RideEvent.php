<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use LogicException;

/** Append-only audit trail of a ride (story S8.3) */
class RideEvent extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['ride_id', 'actor_id', 'type', 'payload'];

    protected function casts(): array
    {
        return ['payload' => 'array', 'created_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Ride events are append-only'));
        static::deleting(fn () => throw new LogicException('Ride events are append-only'));
    }
}
