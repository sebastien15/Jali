<?php

namespace App\Modules\Notifications\Contracts;

use App\Models\User;

/**
 * Push notifications to a user's device (Expo or raw FCM token).
 *
 * Never throws: a failed push must not fail or roll back the request that
 * triggered it. `data` drives deep links in the app and keeps the existing
 * `screen,id` payloads, e.g. ['screen' => 'ride', 'id' => 123].
 */
interface PushSender
{
    /**
     * false when the user has no token or delivery failed. Every push is logged
     * (S12.3) and carries `nid` in its data so the app can report the open.
     *
     * @param array{sms_fallback?: string} $options `sms_fallback`: text to send by SMS when the
     *        push is not opened in time — only for critical events (e.g. driver arrived)
     */
    public function send(User $user, string $title, string $body, array $data = [], array $options = []): bool;
}
