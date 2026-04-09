<?php

namespace App\Http\Middleware;

use App\Models\Role;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Kreait\Firebase\Factory;
use Symfony\Component\HttpFoundation\Response;

class FirebaseAuth
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
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
            $uid      = $verified->claims()->get('sub');
            $email    = $verified->claims()->get('email');
            $name     = $verified->claims()->get('name') ?? 'User';

            // 1. Try to find by firebase_uid (normal path)
            $user = User::with('roles')->where('firebase_uid', $uid)->first();

            // 2. First-time admin login: pre-seeded user has no firebase_uid yet — link by email
            if (!$user && $email) {
                $preSeeded = User::where('email', $email)->whereNull('firebase_uid')->first();
                if ($preSeeded) {
                    $preSeeded->update(['firebase_uid' => $uid]);
                    $preSeeded->load('roles');
                    $user = $preSeeded;
                }
            }

            // 3. Brand-new regular user — create and assign default role
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

            $request->merge(['auth_user' => $user]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Unauthorized', 'message' => 'Invalid token'], 401);
        }

        return $next($request);
    }
}
