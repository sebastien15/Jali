<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
}
