<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A driver's own hire-a-driver prices (story S6.1) */
class DriverHireSetting extends Model
{
    public const FARE_FIELDS = ['hourly_rate', 'min_hours', 'daily_rate', 'daily_hours', 'overtime_per_hour', 'out_of_town_fee',
        'car_hourly_rate', 'km_per_hour', 'extra_km_rate'];

    protected $fillable = ['user_id', 'hourly_rate', 'min_hours', 'daily_rate', 'daily_hours', 'overtime_per_hour', 'out_of_town_fee', 'is_active',
        'offers_car', 'car_vehicle_id', 'car_hourly_rate', 'km_per_hour', 'extra_km_rate'];

    protected function casts(): array
    {
        return [
            'hourly_rate' => 'integer', 'min_hours' => 'integer', 'daily_rate' => 'integer', 'daily_hours' => 'integer',
            'overtime_per_hour' => 'integer', 'out_of_town_fee' => 'integer', 'is_active' => 'boolean',
            'offers_car' => 'boolean', 'car_hourly_rate' => 'integer', 'km_per_hour' => 'integer', 'extra_km_rate' => 'integer',
        ];
    }

    /** S13.7: the car the driver brings, when they offer one */
    public function carVehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'car_vehicle_id');
    }

    /** Offers a usable car: switched on, priced, and the vehicle is active and insured */
    public function carReady(): bool
    {
        $v = $this->carVehicle;

        return $this->offers_car && $this->car_hourly_rate && $this->extra_km_rate !== null && $v && $v->is_active
            && (!$v->insurance_expiry || $v->insurance_expiry->isFuture());
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Prices locked into a hire when it is requested */
    public function snapshot(): array
    {
        return array_intersect_key($this->toArray(), array_flip(self::FARE_FIELDS));
    }
}
