<?php

namespace App\Modules\Identity\Application;

use App\Models\Role;
use App\Models\User;
use App\Modules\Notifications\Contracts\PushTokens;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Auth as FirebaseAuth;

/**
 * Sign-in (email/password, Firebase Google/Apple, phone OTP), sign-out and the
 * current-user payload. Issues Sanctum API tokens. Input shape is validated by
 * the transport; refusals are IdentityRequestRejected with the exact old body.
 */
class Authentication
{
    public function __construct(
        private readonly OtpService $otp,
        private readonly PushTokens $pushTokens,
    ) {
    }

    /** @throws IdentityRequestRejected */
    public function passwordLogin(string $email, string $password): array
    {
        $user = User::with("role")->where("email", $email)->first();

        // Accounts without a password (Google / phone sign-up) can never use
        // email+password login — they must use the provider they signed up with.
        if (!$user || !$user->password || !Hash::check($password, $user->password)) {
            throw IdentityRequestRejected::errorAndMessage(401, "Unauthorized", "Invalid credentials");
        }

        return $this->issueToken($user);
    }

    /**
     * Firebase ID token (Google or Apple sign-in) → API token. Links a Firebase
     * identity to an existing account only when Firebase verified the email.
     *
     * @throws IdentityRequestRejected
     */
    public function firebaseLogin(string $firebaseToken): array
    {
        try {
            $verified = app(FirebaseAuth::class)->verifyIdToken($firebaseToken);
        } catch (\Throwable $e) {
            Log::warning("[GoogleLogin] Token rejected:", ["message" => $e->getMessage()]);
            throw IdentityRequestRejected::errorAndMessage(401, "Unauthorized", "Invalid Google token");
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
                    throw IdentityRequestRejected::errorAndMessage(401, "Unauthorized",
                        "This email is already registered. Sign in with your original method.");
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

        return $this->issueToken($user);
    }

    /** @throws IdentityRequestRejected */
    public function requestOtp(string $rawPhone): void
    {
        $phone = OtpService::normalizePhone($rawPhone);
        if (!$phone) {
            throw new IdentityRequestRejected(422, ["error" => "Validation failed", "message" => ["phone" => ["Enter a valid phone number."]]]);
        }
        if (!$this->otp->available()) {
            Log::error("[OTP] SMS is not configured — phone sign-in is unavailable");

            throw IdentityRequestRejected::errorAndMessage(503, "Unavailable", "Phone sign-in is not available right now. Use email or Google.");
        }
        if (!$this->otp->send($phone)) {
            throw IdentityRequestRejected::errorAndMessage(503, "Unavailable", "We could not send the code. Try again in a minute.");
        }
    }

    /**
     * Verify the code and sign in, creating the account on first use.
     *
     * @throws IdentityRequestRejected
     */
    public function otpLogin(string $rawPhone, string $code): array
    {
        $phone = OtpService::normalizePhone($rawPhone);
        if (!$phone || !$this->otp->verify($phone, $code)) {
            throw IdentityRequestRejected::errorAndMessage(401, "Unauthorized", "Invalid or expired code");
        }

        // Existing accounts may have stored the number in another format
        $user = User::with("role")
            ->whereIn("phone", array_unique(array_filter([
                $phone, $rawPhone, str_starts_with($phone, "+250") ? "0" . substr($phone, 4) : null,
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

        return $this->issueToken($user);
    }

    /** Revoke the current token and stop pushes to this device. */
    public function logout(User $user): void
    {
        $user->currentAccessToken()->delete();
        $this->pushTokens->forget($user);
    }

    /** GET /me: `roles` is the role name string, `permissions` the role's permission names. */
    public function me(User $user): array
    {
        $user->load("role", "location");

        return [
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
        ];
    }

    /** Create an API token and the sign-in response body. */
    public function issueToken(User $user): array
    {
        $token = $user->createToken("api-token")->plainTextToken;

        return [
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
        ];
    }
}
