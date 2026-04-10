<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LocationChangeRequest extends Model
{
    protected $fillable = [
        "admin_id",
        "from_location_id",
        "to_location_id",
        "status",
        "superadmin_id",
        "approved_at",
    ];

    protected function casts(): array
    {
        return [
            "approved_at" => "datetime",
        ];
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, "admin_id");
    }

    public function fromLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, "from_location_id");
    }

    public function toLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, "to_location_id");
    }

    public function superadmin(): BelongsTo
    {
        return $this->belongsTo(User::class, "superadmin_id");
    }
}
