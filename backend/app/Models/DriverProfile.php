<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverProfile extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_VERIFIED = 'verified';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_SUSPENDED = 'suspended';

    protected $fillable = [
        'user_id',
        'services',
        'allowed_zones',
        'docs_url',
        'national_id_no',
        'licence_no',
        'licence_categories',
        'licence_expiry',
        'transmissions',
        'languages',
        'years_experience',
    ];

    protected function casts(): array
    {
        return [
            'services'           => 'array',
            'allowed_zones'      => 'array',
            'licence_categories' => 'array',
            'transmissions'      => 'array',
            'languages'          => 'array',
            'licence_expiry'     => 'date:Y-m-d',
            'verified_at'        => 'datetime',
            'rating_avg'         => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isVerified(): bool
    {
        return $this->verification_status === self::STATUS_VERIFIED;
    }
}
