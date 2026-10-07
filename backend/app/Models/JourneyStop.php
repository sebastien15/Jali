<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One stop of a shared journey (S25.1) */
class JourneyStop extends Model
{
    protected $fillable = ['private_seat_id', 'seq', 'name', 'lat', 'lng', 'time', 'fare_to_next'];

    protected $hidden = ['private_seat_id', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return ['seq' => 'integer', 'fare_to_next' => 'integer', 'lat' => 'float', 'lng' => 'float'];
    }
}
