<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Corridor extends Model
{
    protected $fillable = ['code', 'name', 'description'];

    public function terminals(): BelongsToMany
    {
        return $this->belongsToMany(AdminStation::class, 'corridor_terminals', 'corridor_id', 'terminal_id')
            ->withPivot('stop_order')
            ->orderByPivot('stop_order');
    }

    public function corridorTerminals(): HasMany
    {
        return $this->hasMany(CorridorTerminal::class)->orderBy('stop_order');
    }

    public function agencyRoutes(): HasMany
    {
        return $this->hasMany(AgencyRoute::class);
    }
}
