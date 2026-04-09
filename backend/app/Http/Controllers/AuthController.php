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

            $email = $verified->claims()->get('email');
            $name  = $verified->claims()->get('name') ?? 'User';

            // Try by firebase_uid first
            $user = User::with('roles')->where('firebase_uid', $uid)->first();

            // First-time admin login: pre-seeded user has no firebase_uid — link by email
            if (!$user && $email) {
                $preSeeded = User::where('email', $email)->whereNull('firebase_uid')->first();
                if ($preSeeded) {
                    $preSeeded->update(['firebase_uid' => $uid]);
                    $preSeeded->load('roles');
                    $user = $preSeeded;
                }
            }

            // Brand-new regular user
            if (!$user) {
                $user = User::create([
                    'firebase_uid' => $uid,
                    'name'         => $name,
                    'email'        => $email,
                ]);
                $userRole = Role::where('name', 'user')->first();
                if ($userRole) {
                    $user->roles()->attach($userRole);
                }
                $user->load('roles');
            }

            // Update FCM token if provided
            if ($request->has('fcm_token')) {
                $user->update(['fcm_token' => $request->fcm_token]);
            }

            return response()->json([
                'user' => array_merge($user->toArray(), [
                    'roles' => $user->roles->pluck('name'),
                ]),
                'message' => 'OK',
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Unauthorized', 'message' => 'Invalid token'], 401);
        }
    }
}
