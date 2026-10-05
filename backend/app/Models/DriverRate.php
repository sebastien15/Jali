<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverRate extends Model
{
    /** Fields that make up a fare (also used as the rate snapshot on a ride). */
    public const FARE_FIELDS = [
        'base_fare', 'per_km', 'per_min', 'min_fare', 'pickup_free_km', 'pickup_per_km', 'night_multiplier',
    ];

    protected $fillable = [
        'user_id', 'vehicle_id', 'service', 'base_fare', 'per_km', 'per_min', 'min_fare',
        'pickup_free_km', 'pickup_per_km', 'night_multiplier', 'is_active', 'out_of_band_at',
    ];

    protected function casts(): array
    {
        return [
            'base_fare'        => 'integer',
            'per_km'           => 'integer',
            'per_min'          => 'integer',
            'min_fare'         => 'integer',
            'pickup_free_km'   => 'float',
            'pickup_per_km'    => 'integer',
            'night_multiplier' => 'float',
            'is_active'        => 'boolean',
            'out_of_band_at'   => 'datetime',
        ];
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function fareSnapshot(): array
    {
        return $this->only(self::FARE_FIELDS);
    }
}
