<?php

namespace App\Modules\Notifications\Infrastructure;

use App\Models\PushNotification;
use App\Models\User;
use App\Modules\Notifications\Contracts\PushSender;
use App\Services\PushService;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * PushSender over the existing App\Services\PushService. The service is
 * resolved from the container on every send, so its lazy binding in
 * AppServiceProvider (Firebase client built only when an FCM token is used)
 * and any test replacement of it keep working unchanged.
 *
 * S12.3: each push is logged (type = data.screen) for delivery/open rates;
 * ride requests go to the loud `ride_requests` channel; a critical push can
 * schedule an SMS fallback (notifications:sms-fallback) if not opened in time.
 */
class PushServiceSender implements PushSender
{
    /** Types that ring on the dedicated high-importance channel with the custom sound */
    public const LOUD = ['driver_ride'];

    public function send(User $user, string $title, string $body, array $data = [], array $options = []): bool
    {
        $type = (string) ($data['screen'] ?? 'other');
        $loud = in_array($type, self::LOUD, true);
        $log = null;
        try {
            $log = PushNotification::create([
                'user_id' => $user->id, 'type' => mb_substr($type, 0, 40), 'title' => mb_substr($title, 0, 120),
                'channel' => $loud ? 'ride_requests' : 'default', 'status' => 'failed',
            ]);
            $data['nid'] = $log->id;
        } catch (Throwable $e) {
            Log::warning('Push log failed: ' . $e->getMessage());   // logging must never block the push
        }

        $sent = app(PushService::class)->send($user, $title, $body, $data,
            $loud ? ['channel' => 'ride_requests', 'sound' => 'ride_request.wav'] : []);

        if ($log) {
            $sms = $options['sms_fallback'] ?? null;
            $log->forceFill([
                'status' => $sent ? 'sent' : ($user->fcm_token ? 'failed' : 'no_token'),
                'sms_text' => $sms ? mb_substr($sms, 0, 300) : null,
                // Not delivered at all → text now; delivered → text if not opened in time
                'sms_due_at' => $sms ? ($sent ? now()->addSeconds((int) config('services.push.sms_fallback_seconds', 60)) : now()) : null,
            ])->save();
        }

        return $sent;
    }
}
