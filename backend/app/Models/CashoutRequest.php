<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashoutRequest extends Model
{
    protected $fillable = [
        'admin_id', 'requester_type', 'amount', 'method', 'account_number',
        'account_name', 'bank_name', 'status', 'note', 'processed_at',
    ];

    protected $casts = ['processed_at' => 'datetime'];

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
