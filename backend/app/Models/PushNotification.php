<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Log of one push (S12.3): delivery, open and SMS fallback */
class PushNotification extends Model
{
    protected $fillable = ['user_id', 'type', 'title', 'channel', 'status', 'opened_at', 'sms_text', 'sms_due_at', 'sms_sent_at'];

    protected function casts(): array
    {
        return ['opened_at' => 'datetime', 'sms_due_at' => 'datetime', 'sms_sent_at' => 'datetime'];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
