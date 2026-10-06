<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A driver paying Jali the commission they owe, by MoMo (story S7.2) */
class DriverSettlement extends Model
{
    protected $fillable = ['user_id', 'amount', 'method', 'reference', 'status', 'reviewed_by', 'reviewed_at', 'note'];

    protected function casts(): array
    {
        return ['amount' => 'integer', 'reviewed_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
