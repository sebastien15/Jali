<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverDocument extends Model
{
    public const TYPES = ['licence_front', 'licence_back', 'national_id', 'selfie', 'insurance'];

    public const STATUS_UPLOADED = 'uploaded';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = ['user_id', 'type', 'path', 'status', 'rejection_reason', 'reviewed_by', 'reviewed_at'];

    protected $hidden = ['path'];

    protected function casts(): array
    {
        return ['reviewed_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
