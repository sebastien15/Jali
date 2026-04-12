<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgencyRoute extends Model
{
    use HasFactory;

    protected $fillable = ['agency_id', 'from_station_id', 'to_station_id'];

    public function fromStation(): BelongsTo
    {
        return $this->belongsTo(AdminStation::class, 'from_station_id');
    }

    public function toStation(): BelongsTo
    {
        return $this->belongsTo(AdminStation::class, 'to_station_id');
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }
}
