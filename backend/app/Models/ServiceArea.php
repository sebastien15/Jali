<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A city where Jali works, or a special zone inside one (S10.4). Polygon points are [lat, lng]. */
class ServiceArea extends Model
{
    public const CITY = 'city';
    public const ZONE = 'zone';
    public const ZONE_TYPES = ['airport', 'stadium', 'station', 'pickup', 'other'];

    protected $fillable = [
        'name', 'kind', 'zone_type', 'parent_id', 'polygon', 'min_lat', 'max_lat', 'min_lng', 'max_lng',
        'active', 'overrides', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'polygon'   => 'array',
            'overrides' => 'array',
            'active'    => 'boolean',
            'min_lat'   => 'float',
            'max_lat'   => 'float',
            'min_lng'   => 'float',
            'max_lng'   => 'float',
        ];
    }

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function zones()
    {
        return $this->hasMany(self::class, 'parent_id');
    }
}
