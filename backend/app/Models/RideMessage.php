<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RideMessage extends Model
{
    public const UPDATED_AT = null;

    /** Quick phrases (S9.5) — each app shows them in its own language */
    public const PHRASES = ['on_my_way', 'i_am_here', 'where_are_you', 'wait_2_min', 'cant_find_you', 'at_the_entrance', 'running_late', 'thank_you'];

    protected $fillable = ['ride_id', 'sender_id', 'phrase', 'body'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }
}
