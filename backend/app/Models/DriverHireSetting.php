<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A driver's own hire-a-driver prices (story S6.1) */
class DriverHireSetting extends Model
{
    public const FARE_FIELDS = ['hourly_rate', 'min_hours', 'daily_rate', 'daily_hours', 'overtime_per_hour', 'out_of_town_fee'];

    protected $fillable = ['user_id', 'hourly_rate', 'min_hours', 'daily_rate', 'daily_hours', 'overtime_per_hour', 'out_of_town_fee', 'is_active'];

    protected function casts(): array
    {
        return [
            'hourly_rate' => 'integer', 'min_hours' => 'integer', 'daily_rate' => 'integer', 'daily_hours' => 'integer',
            'overtime_per_hour' => 'integer', 'out_of_town_fee' => 'integer', 'is_active' => 'boolean',
        ];
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
