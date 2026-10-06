<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HireRating extends Model
{
    protected $fillable = ['driver_hire_id', 'from_user_id', 'to_user_id', 'stars', 'tags', 'comment'];

    protected function casts(): array
    {
        return ['tags' => 'array', 'stars' => 'integer'];
    }
}
