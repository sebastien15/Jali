<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Append-only driver ledger row (story S7.2) */
class DriverLedgerEntry extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'driver_ledger';

    protected $fillable = ['user_id', 'source_type', 'source_id', 'type', 'amount', 'balance_effect', 'balance_after', 'note'];

    protected function casts(): array
    {
        return ['amount' => 'integer', 'balance_effect' => 'integer', 'balance_after' => 'integer', 'created_at' => 'datetime'];
    }
}
