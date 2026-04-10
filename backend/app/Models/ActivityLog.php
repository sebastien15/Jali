<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    protected $fillable = [
        "admin_id",
        "action",
        "entity_type",
        "entity_id",
        "details",
    ];

    protected function casts(): array
    {
        return [
            "details" => "array",
        ];
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, "admin_id");
    }
}
