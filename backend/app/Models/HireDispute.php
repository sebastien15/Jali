<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A customer's or driver's dispute of a hire's recorded hours (S6.5) */
class HireDispute extends Model
{
    public const OPEN = 'open';
    public const RESOLVED = 'resolved';

    protected $fillable = ['driver_hire_id', 'user_id', 'role', 'reason', 'claimed_end', 'status', 'resolution', 'resolved_by', 'resolved_at'];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function hire(): BelongsTo
    {
        return $this->belongsTo(DriverHire::class, 'driver_hire_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
