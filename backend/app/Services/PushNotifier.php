<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Sends push notifications through Expo's push service. The app registers
 * an Expo push token (ExponentPushToken[...]) via POST /me/push-token,
 * stored in users.fcm_token.
 */
class PushNotifier
{
    public function send(?User $user, string $title, string $body, array $data = []): void
    {
        $token = $user?->fcm_token;
        if (!$token || !str_starts_with($token, 'ExponentPushToken[')) {
            return;
        }

        // Never let a slow/failed push delay or break the admin's request.
        dispatch(function () use ($token, $title, $body, $data) {
            try {
                Http::timeout(5)->acceptJson()->post('https://exp.host/--/api/v2/push/send', [
                    'to' => $token,
                    'title' => $title,
                    'body' => $body,
                    'data' => $data,
                    'sound' => 'default',
                ])->throw();
            } catch (\Throwable $e) {
                Log::warning('[Push] Expo push failed: ' . $e->getMessage());
            }
        })->afterResponse();
    }
}
