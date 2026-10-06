<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Days an owner keeps a rental car off the market (maintenance, personal use). Dates are inclusive. */
class RentalBlock extends Model
{
    protected $fillable = ['car_rental_id', 'start_date', 'end_date', 'reason'];

    protected function casts(): array
    {
        return ['start_date' => 'date:Y-m-d', 'end_date' => 'date:Y-m-d'];
    }

    public function car(): BelongsTo
    {
        return $this->belongsTo(CarRental::class, 'car_rental_id');
    }
}
