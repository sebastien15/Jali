<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Agency extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'created_by'];

    public function routes(): HasMany
    {
        return $this->hasMany(AgencyRoute::class);
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(AgencyRating::class);
    }

    public function trips(): HasMany
    {
        return $this->hasMany(Trip::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getAverageRatingAttribute(): float
    {
        return round($this->ratings()->avg('stars') ?? 0, 1);
    }
}
