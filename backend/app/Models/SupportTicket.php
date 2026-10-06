<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A customer's or provider's question to Jali support (S16.3) */
class SupportTicket extends Model
{
    public const OPEN = 'open';           // waiting for Jali
    public const ANSWERED = 'answered';   // waiting for the customer
    public const RESOLVED = 'resolved';
    public const STATUSES = [self::OPEN, self::ANSWERED, self::RESOLVED];

    public const SUBJECTS = ['ride', 'hire', 'rental'];
    public const CATEGORIES = ['charged_wrong', 'driver_behaviour', 'lost_item', 'safety', 'cancel', 'damage', 'payment', 'account', 'other'];

    /** Priority and first-response time by category: safety first */
    public const PRIORITY = ['safety' => 'urgent', 'driver_behaviour' => 'high', 'damage' => 'high'];
    public const SLA_MINUTES = ['urgent' => 60, 'high' => 240, 'normal' => 1440];

    protected $fillable = [
        'user_id', 'subject_type', 'subject_id', 'category', 'priority', 'status', 'assigned_to',
        'first_response_due_at', 'first_responded_at', 'last_message_at', 'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'first_response_due_at' => 'datetime',
            'first_responded_at'    => 'datetime',
            'last_message_at'       => 'datetime',
            'resolved_at'           => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportMessage::class, 'ticket_id')->orderBy('id');
    }
}
