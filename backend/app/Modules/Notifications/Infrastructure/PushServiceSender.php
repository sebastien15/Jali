<?php

namespace App\Modules\Notifications\Infrastructure;

use App\Models\User;
use App\Modules\Notifications\Contracts\PushSender;
use App\Services\PushService;

/**
 * PushSender over the existing App\Services\PushService. The service is
 * resolved from the container on every send, so its lazy binding in
 * AppServiceProvider (Firebase client built only when an FCM token is used)
 * and any test replacement of it keep working unchanged.
 */
class PushServiceSender implements PushSender
{
    public function send(User $user, string $title, string $body, array $data = []): bool
    {
        return app(PushService::class)->send($user, $title, $body, $data);
    }
}
