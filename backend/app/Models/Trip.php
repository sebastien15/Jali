<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Trip extends Model
{
    use HasFactory;

    protected $fillable = [
        'agency_id',
        'from_station_id',
        'to_station_id',
        'departure_time',
        'estimated_arrival_time',
        'price',
        'total_seats',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function fromStation(): BelongsTo
    {
        return $this->belongsTo(AdminStation::class, 'from_station_id');
    }

    public function toStation(): BelongsTo
    {
        return $this->belongsTo(AdminStation::class, 'to_station_id');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }
}
