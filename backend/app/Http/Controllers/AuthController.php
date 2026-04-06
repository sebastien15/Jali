<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Kreait\Firebase\Factory;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $token = $request->bearerToken();
        if (!$token) {
            return response()->json(['error' => 'Unauthorized', 'message' => 'No token provided'], 401);
        }

        try {
            $factory = (new Factory)
                ->withServiceAccount(config('firebase.projects.app.credentials'));

            $auth = $factory->createAuth();
            $verified = $auth->verifyIdToken($token);
            $uid = $verified->claims()->get('sub');

            // Find or create user
            $user = User::firstOrCreate(
                ['firebase_uid' => $uid],
                [
                    'name' => $verified->claims()->get('name') ?? 'User',
                    'email' => $verified->claims()->get('email') ?? null,
                ]
            );

            // Assign default 'user' role to newly registered users
            if ($user->wasRecentlyCreated) {
                $userRole = Role::where('name', 'user')->first();
                if ($userRole) {
                    $user->roles()->attach($userRole);
                }
            }

            // Update FCM token if provided
            if ($request->has('fcm_token')) {
                $user->update(['fcm_token' => $request->fcm_token]);
            }

            // Load pending bookings
            $user->load(['bookings' => function ($query) {
                $query->where('status', 'pending');
            }]);

            return response()->json([
                'user' => $user,
                'message' => $user->wasRecentlyCreated ? 'User registered' : 'User logged in',
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Unauthorized', 'message' => 'Invalid token'], 401);
        }
    }
}
