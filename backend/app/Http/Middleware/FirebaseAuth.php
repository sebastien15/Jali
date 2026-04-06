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
            $uid = $verified->claims()->get('sub');

            // Find or create user in PostgreSQL
            $user = User::firstOrCreate(
                ['firebase_uid' => $uid],
                [
                    'name' => $verified->claims()->get('name') ?? 'User',
                    'email' => $verified->claims()->get('email') ?? null,
                ]
            );

            // Assign default 'user' role to newly created users
            if ($user->wasRecentlyCreated) {
                $userRole = Role::where('name', 'user')->first();
                if ($userRole) {
                    $user->roles()->attach($userRole);
                }
            }

            $request->merge(['auth_user' => $user]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Unauthorized', 'message' => 'Invalid token'], 401);
        }

        return $next($request);
    }
}
