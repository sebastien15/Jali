<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class PushTokenController extends Controller
{
    /**
     * POST /me/push-token
     * Registers the device's push token (Expo push token or FCM token) for the current user.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string|max:255',
        ]);

        $request->user()->update(['fcm_token' => $validated['token']]);

        return response()->json(['message' => 'Push token saved']);
    }

    /**
     * DELETE /me/push-token
     * Stops pushes to this account (e.g. notifications turned off on the device).
     */
    public function destroy(Request $request)
    {
        $request->user()->update(['fcm_token' => null]);

        return response()->json(['message' => 'Push token removed']);
    }
}
