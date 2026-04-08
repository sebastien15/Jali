<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CarRental extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'type',
        'price',
        'caution',
        'seats',
        'plate',
        'rating',
        'active',
        'amenities',
        'photos',
    ];

    protected function casts(): array
    {
        return [
            'active'   => 'boolean',
            'amenities' => 'array',
            'photos'    => 'array',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
