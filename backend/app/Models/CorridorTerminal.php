<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CorridorTerminal extends Model
{
    protected $fillable = ['corridor_id', 'terminal_id', 'stop_order'];

    public function corridor(): BelongsTo
    {
        return $this->belongsTo(Corridor::class);
    }

    public function terminal(): BelongsTo
    {
        return $this->belongsTo(AdminStation::class, 'terminal_id');
    }
}
