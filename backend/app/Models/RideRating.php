<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RideRating extends Model
{
    protected $fillable = ['ride_id', 'from_user_id', 'to_user_id', 'stars', 'tags', 'comment'];

    protected function casts(): array
    {
        return ['tags' => 'array', 'stars' => 'integer'];
    }
}
