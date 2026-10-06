<?php

namespace App\Modules\Notifications\Application;

use App\Models\User;
use App\Modules\Notifications\Contracts\PushTokens;

/** The one writer of a user's push token (users.fcm_token), except account anonymisation. */
class PushTokenRegistry implements PushTokens
{
    public function register(User $user, string $token): void
    {
        $user->update(['fcm_token' => $token]);
    }

    public function forget(User $user): void
    {
        $user->update(['fcm_token' => null]);
    }
}
