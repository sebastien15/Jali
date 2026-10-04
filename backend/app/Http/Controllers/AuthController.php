<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
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

        // Accounts without a password (Google / phone sign-up) can never use
        // email+password login — they must use the provider they signed up with.
        if (!$user || !$user->password || !Hash::check($request->password, $user->password)) {
            return response()->json(
                ["error" => "Unauthorized", "message" => "Invalid credentials"],
                401,
            );
        }

        return $this->respondWithToken($user);
    }

    /**
     * Firebase Google Sign-In → Laravel token
     * Client sends Firebase ID token, we verify it and return a Laravel API token
     */
    public function loginWithGoogle(Request $request)
    {
        $validator = Validator::make($request->all(), [
            "firebase_token" => "required|string",
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
            $name = $verified->claims()->get("name") ?? "User";

            $user = User::with("role")->where("firebase_uid", $uid)->first();

            // First-time admin login: link pre-seeded user
            if (!$user && $email) {
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
    public function requestOtp(Request $request)
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

        // TODO: Integrate with SMS provider (Twilio/Africa's Talking)
        // For now, we just log it (in development, OTP is always "123456")
        Log::info("[OTP] Requested for:", ["phone" => $request->phone]);

        return response()->json(["message" => "OTP sent"]);
    }

    /**
     * Verify OTP and login
     */
    public function verifyOtp(Request $request)
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

        // TODO: Verify OTP with SMS provider
        // For development: accept "123456" as valid
        if ($request->otp !== "123456") {
            return response()->json(
                ["error" => "Unauthorized", "message" => "Invalid OTP"],
                401,
            );
        }

        $user = User::with("role")->where("phone", $request->phone)->first();

        if (!$user) {
            $userRole = Role::where("name", "user")->first();
            $user = User::create([
                "name" => "User",
                "phone" => $request->phone,
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
        $request->user()->currentAccessToken()->delete();
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
