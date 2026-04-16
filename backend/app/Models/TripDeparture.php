<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TripDeparture extends Model
{
    protected $fillable = ['agency_route_id', 'departure_time', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    public function route(): BelongsTo
    {
        return $this->belongsTo(AgencyRoute::class, 'agency_route_id');
    }

    public function estimatedArrival(): string
    {
        [$h, $m] = array_map('intval', explode(':', substr($this->departure_time, 0, 5)));
        $total = $h * 60 + $m + $this->route->duration_mins;
        return sprintf('%02d:%02d', intdiv($total % (24 * 60), 60), $total % 60);
    }
}
