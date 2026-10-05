<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\SmsSender;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Kreait\Firebase\Contract\Auth as FirebaseAuth;
use App\Models\AdminStation;
use App\Models\CarRental;
use App\Models\PrivateSeat;
use Illuminate\Support\Facades\DB;

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
            $verified = app(FirebaseAuth::class)->verifyIdToken($request->firebase_token);
        } catch (\Throwable $e) {
            Log::warning("[GoogleLogin] Token rejected:", ["message" => $e->getMessage()]);
            return response()->json(
                ["error" => "Unauthorized", "message" => "Invalid Google token"],
                401,
            );
        }

        $uid = $verified->claims()->get("sub");
        $email = $verified->claims()->get("email");
        $emailVerified = $verified->claims()->get("email_verified") === true;
        $name = $verified->claims()->get("name") ?? "User";

        $user = User::with("role")->where("firebase_uid", $uid)->first();

        if (!$user && $email) {
            $existing = User::where("email", $email)->first();
            if ($existing) {
                // Only link a Firebase identity to an existing account (e.g. a
                // pre-provisioned admin) when Firebase has verified the email —
                // otherwise anyone could register that address and take it over.
                if (!$emailVerified || $existing->firebase_uid !== null) {
                    return response()->json(
                        [
                            "error" => "Unauthorized",
                            "message" => "This email is already registered. Sign in with your original method.",
                        ],
                        401,
                    );
                }
                $existing->forceFill(["firebase_uid" => $uid])->save();
                $user = $existing->load("role");
            }
        }

        // Create new user
        if (!$user) {
            $userRole = Role::where("name", "user")->first();
            $user = User::create([
                "firebase_uid" => $uid,
                "name" => $name,
                "email" => $emailVerified ? $email : null,
                "role_id" => $userRole ? $userRole->id : null,
            ]);
            $user->load("role");
        }

        return $this->respondWithToken($user);
    }

    /**
     * Request OTP for phone number
     */
    public function requestOtp(Request $request, SmsSender $sms)
    {
        $phone = $this->normalizePhone((string) $request->input("phone"));
        if (!$phone) {
            return response()->json(
                [
                    "error" => "Validation failed",
                    "message" => ["phone" => ["Enter a valid Rwandan mobile number."]],
                ],
                422,
            );
        }

        if (!$sms->isConfigured()) {
            return response()->json(
                ["error" => "Unavailable", "message" => "Phone login is not available yet."],
                503,
            );
        }

        $ttl = config("services.otp.ttl_minutes");
        $code = (string) random_int(100000, 999999);
        Cache::put(
            $this->otpCacheKey($phone),
            ["hash" => Hash::make($code), "attempts" => 0],
            now()->addMinutes($ttl),
        );
        $sms->send($phone, "Your Jali code is {$code}. It expires in {$ttl} minutes.");

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

        $phone = $this->normalizePhone($request->phone);
        if (!$phone || !$this->otpIsValid($phone, $request->otp)) {
            return response()->json(
                ["error" => "Unauthorized", "message" => "Invalid or expired OTP"],
                401,
            );
        }

        $user = User::with("role")->where("phone", $phone)->first();

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
     * Check an OTP against the cached hash. Codes are single-use and the
     * entry is dropped after too many wrong attempts.
     */
    protected function otpIsValid(string $phone, string $otp): bool
    {
        $devCode = config("services.otp.dev_code");
        if ($devCode && app()->environment("local", "testing") && hash_equals((string) $devCode, $otp)) {
            return true;
        }

        $key = $this->otpCacheKey($phone);
        $entry = Cache::get($key);
        if (!$entry) {
            return false;
        }

        if (Hash::check($otp, $entry["hash"])) {
            Cache::forget($key);
            return true;
        }

        $entry["attempts"]++;
        if ($entry["attempts"] >= config("services.otp.max_attempts")) {
            Cache::forget($key);
        } else {
            Cache::put($key, $entry, now()->addMinutes(config("services.otp.ttl_minutes")));
        }
        return false;
    }

    protected function otpCacheKey(string $phone): string
    {
        return "otp:" . $phone;
    }

    /**
     * Normalise Rwandan mobile numbers to +2507XXXXXXXX; null if invalid.
     */
    protected function normalizePhone(string $phone): ?string
    {
        $digits = preg_replace('/\D+/', "", $phone);
        if (preg_match('/^(?:250|0)?(7\d{8})$/', $digits, $m)) {
            return "+250" . $m[1];
        }
        return null;
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
     * Delete the authenticated user's account.
     *
     * The row is anonymised rather than removed: a hard delete cascaded to
     * the user's bookings, ratings and cashouts and — for a station agent —
     * to their whole terminal with its routes and departures. Personal data
     * is wiped, listings are deactivated, and every token is revoked.
     */
    public function deleteAccount(Request $request)
    {
        $user = $request->user();

        if ($user->isSuperAdmin() && User::whereHas("role", fn ($q) => $q->where("name", "superadmin"))->count() <= 1) {
            return response()->json(["message" => "The last superadmin account cannot be deleted."], 422);
        }

        DB::transaction(function () use ($user) {
            $user->tokens()->delete();
            AdminStation::where("user_id", $user->id)->update(["user_id" => null]);
            PrivateSeat::where("user_id", $user->id)->update(["active" => false]);
            CarRental::where("user_id", $user->id)->update(["active" => false]);

            $user->forceFill([
                "name" => "Deleted user",
                "email" => null,
                "phone" => null,
                "password" => null,
                "firebase_uid" => null,
                "fcm_token" => null,
                "profile_image_url" => null,
                "whatsapp_number" => null,
                "contract_doc_url" => null,
                "cashout_method" => null,
                "cashout_account_number" => null,
                "cashout_account_name" => null,
                "cashout_bank_name" => null,
                "driver_profile" => null,
                "role_id" => Role::where("name", "user")->value("id"),
            ])->save();
        });

        return response()->json(["message" => "Account deleted."]);
    }

    /**
     * Register the device's Expo push token for booking notifications.
     */
    public function savePushToken(Request $request)
    {
        $data = $request->validate([
            "token" => ["required", "string", "max:255", "regex:/^ExponentPushToken\[[A-Za-z0-9_-]+\]$/"],
        ]);

        $request->user()->forceFill(["fcm_token" => $data["token"]])->save();

        return response()->json(["ok" => true]);
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
