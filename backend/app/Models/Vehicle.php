<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Vehicle extends Model
{
    public const CLASSES = ['moto', 'car', 'comfort', 'van'];

    protected $fillable = [
        'user_id',
        'class',
        'body_type',
        'make',
        'model',
        'color',
        'year',
        'plate',
        'seats',
        'amenities',
        'photos',
        'insurance_expiry',
        'rental_price_day',
        'rental_caution',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'amenities'        => 'array',
            'photos'           => 'array',
            'insurance_expiry' => 'date:Y-m-d',
            'is_active'        => 'boolean',
            'verified_at'      => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** Uppercase, single-spaced plate so "rab 123a" and "RAB  123A" are the same car. */
    public static function normalizePlate(string $plate): string
    {
        return strtoupper(preg_replace('/\s+/', ' ', trim($plate)));
    }

    public function hasValidInsurance(): bool
    {
        return $this->insurance_expiry !== null && $this->insurance_expiry->endOfDay()->isFuture();
    }
}
