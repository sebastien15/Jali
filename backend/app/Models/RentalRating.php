<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RentalRating extends Model
{
    protected $fillable = ['rental_booking_id', 'from_user_id', 'to_user_id', 'stars', 'comment'];
}
