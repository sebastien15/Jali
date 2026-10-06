<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A car offered for rent (Modules/Rentals). Separate from the drivers' own
 * driving Vehicles. `price` is the daily price (owner-facing name: priceDay).
 */
class CarRental extends Model
{
    public const TYPES = ['Sedan', 'SUV', 'Minivan', 'Pickup', 'Hatchback', 'Van', 'Luxury'];
    public const TRANSMISSIONS = ['automatic', 'manual'];
    public const FUEL_TYPES = ['petrol', 'diesel', 'hybrid', 'electric'];
    public const FUEL_POLICIES = ['same_to_same', 'full_to_full', 'prepaid'];
    public const CANCELLATION_POLICIES = ['flexible', 'moderate', 'strict'];
    public const ALLOWED_KEYS = ['smoking', 'pets', 'outside_kigali', 'cross_border'];
    public const DOCUMENT_TYPES = ['registration', 'insurance'];

    public const PENDING = 'pending';
    public const VERIFIED = 'verified';
    public const REJECTED = 'rejected';

    protected $fillable = [
        'user_id', 'name', 'type', 'price', 'caution', 'seats', 'plate', 'rating', 'active', 'amenities', 'photos',
        'status', 'notes', 'make', 'model', 'year', 'color', 'transmission', 'fuel_type', 'doors', 'luggage',
        'description', 'city', 'pickup_address', 'pickup_lat', 'pickup_lng', 'delivery_available', 'delivery_fee',
        'mileage_limit_km', 'extra_km_fee', 'fuel_policy', 'min_driver_age', 'min_licence_years', 'min_days',
        'max_days', 'notice_hours', 'weekly_discount_pct', 'monthly_discount_pct', 'cancellation_policy',
        'allowed', 'rules', 'documents', 'insurance_expiry', 'verification_status', 'verification_note',
        'verified_at', 'trips_count',
    ];

    /** Private file paths and review notes never go to the public catalogue */
    protected $hidden = ['documents', 'verification_note'];

    protected function casts(): array
    {
        return [
            'active'             => 'boolean',
            'amenities'          => 'array',
            'photos'             => 'array',
            'allowed'            => 'array',
            'rules'              => 'array',
            'documents'          => 'array',
            'delivery_available' => 'boolean',
            'pickup_lat'         => 'float',
            'pickup_lng'         => 'float',
            'insurance_expiry'   => 'date:Y-m-d',
            'verified_at'        => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function blocks(): HasMany
    {
        return $this->hasMany(RentalBlock::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(RentalBooking::class);
    }

    /** Can be found and booked by customers */
    public function isBookable(): bool
    {
        return $this->active && $this->verification_status === self::VERIFIED && $this->status !== 'maintenance';
    }
}
