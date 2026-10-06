<?php

namespace App\Modules\Notifications\Application;

use App\Models\PushNotification;
use App\Models\User;
use App\Modules\Notifications\Contracts\SmsSender;
use Illuminate\Support\Facades\DB;

/** Delivery/open rates per notification type and the SMS fallback run (S12.3). */
class PushStats
{
    public function __construct(private SmsSender $sms)
    {
    }

    /** The user tapped the notification: false when it isn't theirs. The first open counts and cancels the SMS. */
    public static function opened(User $user, int $id): bool
    {
        if (!PushNotification::whereKey($id)->where('user_id', $user->id)->exists()) {
            return false;
        }
        PushNotification::whereKey($id)->whereNull('opened_at')->update(['opened_at' => now()]);

        return true;
    }

    public static function byType(int $days): array
    {
        return PushNotification::where('created_at', '>=', now()->subDays($days))
            ->groupBy('type')->orderBy('type')
            ->select('type',
                DB::raw('count(*) as total'),
                DB::raw("sum(case when status = 'sent' then 1 else 0 end) as delivered"),
                DB::raw("sum(case when status = 'no_token' then 1 else 0 end) as no_token"),
                DB::raw('sum(case when opened_at is not null then 1 else 0 end) as opened'),
                DB::raw('sum(case when sms_sent_at is not null then 1 else 0 end) as sms_fallbacks'))
            ->get()
            ->map(fn ($r) => [
                'type' => $r->type, 'total' => (int) $r->total, 'delivered' => (int) $r->delivered, 'no_token' => (int) $r->no_token,
                'opened' => (int) $r->opened, 'sms_fallbacks' => (int) $r->sms_fallbacks,
                'delivery_rate' => $r->total ? round($r->delivered / $r->total, 3) : 0.0,
                'open_rate' => $r->delivered ? round($r->opened / $r->delivered, 3) : 0.0,
            ])->all();
    }

    /** Text the critical pushes nobody opened in time. Returns how many SMS were sent. */
    public function sendDueSms(): int
    {
        $sent = 0;
        PushNotification::whereNotNull('sms_due_at')->whereNull('sms_sent_at')->whereNull('opened_at')
            ->where('sms_due_at', '<=', now())->with('user:id,phone')->limit(200)->get()
            ->each(function (PushNotification $n) use (&$sent) {
                // Claim the row first so two runs never text twice
                if (!PushNotification::whereKey($n->id)->whereNull('sms_sent_at')->update(['sms_sent_at' => now()])) {
                    return;
                }
                if ($n->user?->phone && $this->sms->send($n->user->phone, $n->sms_text)) {
                    $sent++;
                }
            });

        return $sent;
    }
}
