<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AppAccess extends Model
{
    public $timestamps = false;

    protected $fillable = ['platform', 'user_id', 'ip_address', 'accessed_at'];

    protected $casts = ['accessed_at' => 'datetime'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
