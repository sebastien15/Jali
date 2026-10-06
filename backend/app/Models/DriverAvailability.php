<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Weekly working hours (weekday rows) and blocked dates (date rows) — story S6.2 */
class DriverAvailability extends Model
{
    protected $table = 'driver_availability';

    protected $fillable = ['user_id', 'weekday', 'date', 'start_time', 'end_time', 'is_blocked'];

    protected function casts(): array
    {
        return ['weekday' => 'integer', 'date' => 'date:Y-m-d', 'is_blocked' => 'boolean'];
    }
}
