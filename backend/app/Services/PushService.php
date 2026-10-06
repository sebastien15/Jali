<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Factory;
use Throwable;

/**
 * One place to send push notifications.
 *
 * The mobile app registers an Expo push token (ExponentPushToken[...]), which is
 * delivered through Expo's push API so it works on both Android and iOS. Raw FCM
 * device tokens (older installs) are sent through Firebase Cloud Messaging.
 *
 * Never throws: a failed push must not fail the request that triggered it.
 * The `data` payload drives deep links in the app, e.g. ['screen' => 'ride', 'id' => 123].
 */
class PushService
{
    public const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

    public function __construct(private ?Messaging $messaging = null)
    {
    }

    /**
     * @param array{channel?: string, sound?: string} $options Android channel and sound (S12.3);
     *        ride requests use the loud `ride_requests` channel and `ride_request.wav`.
     */
    public function send(User $user, string $title, string $body, array $data = [], array $options = []): bool
    {
        $token = $user->fcm_token;
        if (!$token) {
            Log::debug('Push skipped: user has no push token', ['user_id' => $user->id]);
            return false;
        }

        // FCM and Expo both expect string values in the data payload
        $data = array_map(fn ($v) => is_scalar($v) ? (string) $v : json_encode($v), $data);

        try {
            return self::isExpoToken($token)
                ? $this->sendViaExpo($token, $title, $body, $data, $options)
                : $this->sendViaFcm($token, $title, $body, $data, $options);
        } catch (Throwable $e) {
            Log::error('Push notification failed: ' . $e->getMessage(), ['user_id' => $user->id]);
            return false;
        }
    }

    public static function isExpoToken(string $token): bool
    {
        return str_starts_with($token, 'ExponentPushToken[') || str_starts_with($token, 'ExpoPushToken[');
    }

    private function sendViaExpo(string $token, string $title, string $body, array $data, array $options = []): bool
    {
        $response = Http::acceptJson()->timeout(10)->post(self::EXPO_ENDPOINT, [
            'to'        => $token,
            'title'     => $title,
            'body'      => $body,
            'data'      => (object) $data,
            'sound'     => $options['sound'] ?? 'default',
            'priority'  => 'high',
            'channelId' => $options['channel'] ?? 'default',
        ]);

        if (!$response->successful() || $response->json('data.status') === 'error') {
            Log::warning('Expo push rejected', ['response' => $response->json()]);
            return false;
        }

        return true;
    }

    private function sendViaFcm(string $token, string $title, string $body, array $data, array $options = []): bool
    {
        $message = [
            'token'        => $token,
            'notification' => ['title' => $title, 'body' => $body],
            // High priority so Android delivers it at once, even in Doze (S12.3)
            'android'      => ['priority' => 'high', 'notification' => [
                'channel_id' => $options['channel'] ?? 'default', 'sound' => $options['sound'] ?? 'default',
            ]],
            'apns'         => ['headers' => ['apns-priority' => '10'], 'payload' => ['aps' => ['sound' => $options['sound'] ?? 'default']]],
        ];
        if ($data) {
            $message['data'] = $data;
        }

        $this->messaging()->send($message);

        return true;
    }

    private function messaging(): Messaging
    {
        return $this->messaging ??= (new Factory())
            ->withServiceAccount(config('firebase.projects.app.credentials'))
            ->createMessaging();
    }
}
