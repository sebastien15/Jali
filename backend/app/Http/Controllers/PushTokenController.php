<?php

namespace App\Http\Controllers;

use App\Modules\Notifications\Contracts\PushTokens;
use Illuminate\Http\Request;

/** Transport adapter for Notifications (M03-Remaining): validation + HTTP shape only. */
class PushTokenController extends Controller
{
    public function __construct(private readonly PushTokens $tokens)
    {
    }

    /**
     * POST /me/push-token
     * Registers the device's push token (Expo push token or FCM token) for the current user.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string|max:255',
        ]);

        $this->tokens->register($request->user(), $validated['token']);

        return response()->json(['message' => 'Push token saved']);
    }

    /**
     * DELETE /me/push-token
     * Stops pushes to this account (e.g. notifications turned off on the device).
     */
    public function destroy(Request $request)
    {
        $this->tokens->forget($request->user());

        return response()->json(['message' => 'Push token removed']);
    }
}
