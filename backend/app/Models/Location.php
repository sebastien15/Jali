<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Location extends Model
{
    protected $fillable = [
        "name",
        "type",
        "city",
        "address",
        "latitude",
        "longitude",
    ];

    protected function casts(): array
    {
        return [
            "latitude" => "float",
            "longitude" => "float",
        ];
    }

    // Admin assigned to this location
    public function admins(): HasMany
    {
        return $this->hasMany(User::class, "location_id");
    }

    // Bookings tied to this location
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    // Outgoing location change requests
    public function changeRequestsFrom(): HasMany
    {
        return $this->hasMany(LocationChangeRequest::class, "from_location_id");
    }

    // Incoming location change requests
    public function changeRequestsTo(): HasMany
    {
        return $this->hasMany(LocationChangeRequest::class, "to_location_id");
    }
}
