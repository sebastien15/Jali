<?php

namespace App\Modules\Notifications\Contracts;

use App\Models\User;

/** The device push token stored on a user (users.fcm_token). */
interface PushTokens
{
    /** Pushes go to this token from now on (Expo push token or FCM token). */
    public function register(User $user, string $token): void;

    /** Stop pushes to this user (signed out, or notifications turned off). */
    public function forget(User $user): void;
}
