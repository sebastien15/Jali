<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Booking extends Model
{
    protected $fillable = [
        "user_id",
        "location_id",
        "type",
        "reference_id",
        "title",
        "sub",
        "price",
        "service_fee",
        "status",
        "ticket_photo_url",
        "payment_method",
        "paid_at",
        "travel_date",
    ];

    protected function casts(): array
    {
        return [
            "paid_at" => "datetime",
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }
}
