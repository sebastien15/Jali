<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminStation extends Model
{
    protected $fillable = ['user_id', 'city'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
