<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PrivateSeat extends Model
{
    protected $fillable = [
        'user_id',
        'driver',
        'from',
        'pickup_station',
        'to',
        'drop_location',
        'dep',
        'date',
        'price',
        'seats',
        'rating',
        'active',
        'amenities',
        'group_discount',
        'group_min_size',
        'group_discount_pct',
        'allow_custom_pickup',
        'custom_pickup_fee',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'active'              => 'boolean',
            'amenities'           => 'array',
            'group_discount'      => 'boolean',
            'allow_custom_pickup' => 'boolean',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** S25.1: ordered stops; empty for a plain from → to listing */
    public function stops(): HasMany
    {
        return $this->hasMany(JourneyStop::class)->orderBy('seq');
    }

    /** Fare per seat from stop `from` to stop `to` (seq), the sum of the segments ridden */
    public function segmentFare(int $from, int $to): int
    {
        if ($this->stops->isEmpty()) {
            return (int) $this->price;
        }

        return (int) $this->stops->filter(fn (JourneyStop $s) => $s->seq >= $from && $s->seq < $to)->sum('fare_to_next');
    }
}
