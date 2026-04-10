<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Factory;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        Log::info("[Auth] Login attempt", [
            "has_token" => $request->bearerToken() !== null,
            "has_fcm" => $request->has("fcm_token"),
        ]);

        $token = $request->bearerToken();
        if (!$token) {
            Log::warn("[Auth] No token provided");
            return response()->json(
                ["error" => "Unauthorized", "message" => "No token provided"],
                401,
            );
        }

        try {
            $configPath = config("firebase.projects.app.credentials");

            // Resolve relative paths against storage_path() for portability
            if (
                !str_starts_with($configPath, "/") &&
                !str_starts_with($configPath, "\\")
            ) {
                $configPath = storage_path($configPath);
            }

            Log::info("[Auth] Loading Firebase credentials", [
                "resolved_path" => $configPath,
            ]);

            $factory = new Factory();
            $factory = $factory->withServiceAccount($configPath);

            Log::info("[Auth] Verifying Firebase ID token", [
                "token_start" => substr($token, 0, 20) . "...",
            ]);

            $auth = $factory->createAuth();
            $verified = $auth->verifyIdToken($token);

            $uid = $verified->claims()->get("sub");
            $email = $verified->claims()->get("email");
            $name = $verified->claims()->get("name") ?? "User";

            Log::info("[Auth] Token verified", [
                "uid" => $uid,
                "email" => $email,
            ]);

            // Try by firebase_uid first
            $user = User::with("roles")->where("firebase_uid", $uid)->first();

            Log::info("[Auth] User lookup by UID", ["found" => $user !== null]);

            // First-time admin login: pre-seeded user has no firebase_uid — link by email
            if (!$user && $email) {
                $preSeeded = User::where("email", $email)
                    ->whereNull("firebase_uid")
                    ->first();
                Log::info("[Auth] Pre-seeded lookup by email", [
                    "found" => $preSeeded !== null,
                ]);
                if ($preSeeded) {
                    $preSeeded->update(["firebase_uid" => $uid]);
                    $preSeeded->load("roles");
                    $user = $preSeeded;
                }
            }

            // Brand-new regular user
            if (!$user) {
                Log::info("[Auth] Creating new user", ["email" => $email]);
                $user = User::create([
                    "firebase_uid" => $uid,
                    "name" => $name,
                    "email" => $email,
                ]);
                $userRole = Role::where("name", "user")->first();
                if ($userRole) {
                    $user->roles()->attach($userRole);
                }
                $user->load("roles");
            }

            Log::info("[Auth] Login successful", [
                "user_id" => $user->id,
                "roles" => $user->roles->pluck("name")->toArray(),
            ]);

            return response()->json([
                "user" => array_merge($user->toArray(), [
                    "roles" => $user->roles->pluck("name"),
                ]),
                "message" => "OK",
            ]);
        } catch (\Exception $e) {
            Log::error("[Auth] Login failed", [
                "class" => get_class($e),
                "message" => $e->getMessage(),
                "file" => $e->getFile(),
                "line" => $e->getLine(),
                "trace" => $e->getTraceAsString(),
            ]);
            return response()->json(
                [
                    "error" => "Unauthorized",
                    "message" => "Invalid token",
                    "debug" => $e->getMessage(),
                ],
                401,
            );
        }
    }
}
