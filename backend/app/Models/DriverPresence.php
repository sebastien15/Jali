<?php

namespace App\Models;

use App\Services\Rides\RideSettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverPresence extends Model
{
    protected $table = 'driver_presence';
    protected $primaryKey = 'user_id';
    public $incrementing = false;

    protected $fillable = ['user_id', 'vehicle_id', 'is_online', 'lat', 'lng', 'heading', 'last_seen_at', 'online_since'];

    protected function casts(): array
    {
        return [
            'is_online'    => 'boolean',
            'lat'          => 'float',
            'lng'          => 'float',
            'heading'      => 'float',
            'last_seen_at' => 'datetime',
            'online_since' => 'datetime',
        ];
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    /** Online and heard from within the presence TTL. */
    public function scopeLive(Builder $query): Builder
    {
        $ttl = (int) RideSettings::get()['presence_ttl_sec'];

        return $query->where('is_online', true)->where('last_seen_at', '>=', now()->subSeconds($ttl));
    }
}
