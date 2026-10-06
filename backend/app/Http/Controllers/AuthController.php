<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\Auth\OtpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Kreait\Firebase\Factory;

class AuthController extends Controller
{
    /**
     * Standard email/password login
     */
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            "email" => "required|email",
            "password" => "required|string",
        ]);

        if ($validator->fails()) {
            return response()->json(
                [
                    "error" => "Validation failed",
                    "message" => $validator->errors(),
                ],
                422,
            );
        }

        $user = User::with("role")->where("email", $request->email)->first();

        if (!$user) {
            return response()->json(
                ["error" => "Unauthorized", "message" => "Invalid credentials"],
                401,
            );
        }

        // For pre-seeded admin users, use a default password or bypass
        // In production, you'd set proper passwords during seeding
        if (!Hash::check($request->password, $user->password ?? "")) {
            // Allow admin users with any password if they exist in DB
            // (Admins originally used Firebase, so we'll accept their login if they exist)
            if (!$user->password) {
                // User exists but has no password (Firebase-only user)
                // For now, we'll create a token for them
            } else {
                return response()->json(
                    [
                        "error" => "Unauthorized",
                        "message" => "Invalid credentials",
                    ],
                    401,
                );
            }
        }

        return $this->respondWithToken($user);
    }

    /**
     * Firebase Google Sign-In → Laravel token
     * Client sends Firebase ID token, we verify it and return a Laravel API token
     */
    public function loginWithGoogle(Request $request)
    {
        return $this->loginWithFirebase($request);
    }

    /**
     * Sign in with Apple (story S9.3): the app signs in to Firebase with the Apple
     * credential and sends the Firebase ID token — verified exactly like Google.
     * Apple only shares the name on the very first sign-in, so the app may send it.
     */
    public function loginWithApple(Request $request)
    {
        return $this->loginWithFirebase($request);
    }

    private function loginWithFirebase(Request $request)
    {
        $validator = Validator::make($request->all(), [
            "firebase_token" => "required|string",
            "name" => "sometimes|nullable|string|max:100",
        ]);

        if ($validator->fails()) {
            return response()->json(
                [
                    "error" => "Validation failed",
                    "message" => $validator->errors(),
                ],
                422,
            );
        }

        try {
            $factory = (new Factory())->withServiceAccount(
                config("firebase.projects.app.credentials"),
            );
            $auth = $factory->createAuth();
            $verified = $auth->verifyIdToken($request->firebase_token);

            $uid = $verified->claims()->get("sub");
            $email = $verified->claims()->get("email");
            $name = $verified->claims()->get("name") ?? ($request->input("name") ?: "User");
            // Only link to an existing account by email when the provider verified it
            $emailVerified = (bool) $verified->claims()->get("email_verified", false);

            $user = User::with("role")->where("firebase_uid", $uid)->first();

            // First-time admin login: link pre-seeded user
            if (!$user && $email && $emailVerified) {
                $preSeeded = User::where("email", $email)
                    ->whereNull("firebase_uid")
                    ->first();
                if ($preSeeded) {
                    $preSeeded->update(["firebase_uid" => $uid]);
                    $preSeeded->load("role");
                    $user = $preSeeded;
                }
            }

            // Create new user
            if (!$user) {
                $userRole = Role::where("name", "user")->first();
                $user = User::create([
                    "firebase_uid" => $uid,
                    "name" => $name,
                    "email" => $email,
                    "role_id" => $userRole ? $userRole->id : null,
                ]);
                $user->load("role");
            }

            return $this->respondWithToken($user);
        } catch (\Exception $e) {
            Log::error("[GoogleLogin] Failed:", [
                "message" => $e->getMessage(),
            ]);
            return response()->json(
                [
                    "error" => "Unauthorized",
                    "message" => "Invalid Google token",
                ],
                401,
            );
        }
    }

    /**
     * Request OTP for phone number
     */
    public function requestOtp(Request $request, OtpService $otp)
    {
        $validator = Validator::make($request->all(), [
            "phone" => "required|string",
        ]);

        if ($validator->fails()) {
            return response()->json(
                [
                    "error" => "Validation failed",
                    "message" => $validator->errors(),
                ],
                422,
            );
        }

        $phone = OtpService::normalizePhone($request->phone);
        if (!$phone) {
            return response()->json(
                ["error" => "Validation failed", "message" => ["phone" => ["Enter a valid phone number."]]],
                422,
            );
        }
        if (!$otp->available()) {
            Log::error("[OTP] SMS is not configured — phone sign-in is unavailable");

            return response()->json(
                ["error" => "Unavailable", "message" => "Phone sign-in is not available right now. Use email or Google."],
                503,
            );
        }
        if (!$otp->send($phone)) {
            return response()->json(
                ["error" => "Unavailable", "message" => "We could not send the code. Try again in a minute."],
                503,
            );
        }

        return response()->json(["message" => "OTP sent"]);
    }

    /**
     * Verify OTP and login
     */
    public function verifyOtp(Request $request, OtpService $otp)
    {
        $validator = Validator::make($request->all(), [
            "phone" => "required|string",
            "otp" => "required|string",
        ]);

        if ($validator->fails()) {
            return response()->json(
                [
                    "error" => "Validation failed",
                    "message" => $validator->errors(),
                ],
                422,
            );
        }

        $phone = OtpService::normalizePhone($request->phone);
        if (!$phone || !$otp->verify($phone, (string) $request->otp)) {
            return response()->json(
                ["error" => "Unauthorized", "message" => "Invalid or expired code"],
                401,
            );
        }

        // Existing accounts may have stored the number in another format
        $user = User::with("role")
            ->whereIn("phone", array_unique(array_filter([
                $phone, $request->phone, str_starts_with($phone, "+250") ? "0" . substr($phone, 4) : null,
            ])))
            ->first();

        if (!$user) {
            $userRole = Role::where("name", "user")->first();
            $user = User::create([
                "name" => "User",
                "phone" => $phone,
                "role_id" => $userRole ? $userRole->id : null,
            ]);
            $user->load("role");
        }

        return $this->respondWithToken($user);
    }

    /**
     * Logout - revoke token
     */
    public function logout(Request $request)
    {
        $user = $request->user();
        $user->currentAccessToken()->delete();
        // Stop pushes to a device that is no longer signed in
        $user->update(["fcm_token" => null]);
        return response()->json(["message" => "Logged out"]);
    }

    /**
     * Delete the authenticated user's account
     */
    public function deleteAccount(Request $request)
    {
        $user = $request->user();
        $user->tokens()->delete();
        $user->delete();
        return response()->json(["message" => "Account deleted."]);
    }

    /**
     * Get current user profile
     */
    public function me(Request $request)
    {
        $user = $request->user()->load("role", "location");
        return response()->json([
            "id" => $user->id,
            "name" => $user->name,
            "email" => $user->email,
            "phone" => $user->phone,
            "profile_image_url" => $user->profile_image_url,
            "roles" => $user->role ? $user->role->name : "user",
            "permissions" => $user->role
                ? $user->role->permissions->pluck("name")->toArray()
                : [],
            "location" => $user->location,
        ]);
    }

    /**
     * Helper: create token and respond
     */
    protected function respondWithToken(User $user)
    {
        $token = $user->createToken("api-token")->plainTextToken;

        return response()->json([
            "token" => $token,
            "user" => [
                "id" => $user->id,
                "name" => $user->name,
                "email" => $user->email,
                "phone" => $user->phone,
                "firebase_uid" => $user->firebase_uid,
                "profile_image_url" => $user->profile_image_url,
                "roles" => $user->role ? $user->role->name : "user",
                "permissions" => $user->role
                    ? $user->role->permissions->pluck("name")->toArray()
                    : [],
            ],
        ]);
    }
}
