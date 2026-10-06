<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Identity\Application\AccountDeletion;
use App\Modules\Identity\Application\Authentication;
use App\Modules\Identity\Application\IdentityRequestRejected;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/** Transport adapter for Identity (M03-Remaining): validation + HTTP shape only. */
class AuthController extends Controller
{
    public function __construct(private readonly Authentication $auth)
    {
    }

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
            return $this->validationFailed($validator);
        }

        return $this->attempt(fn () => $this->auth->passwordLogin($request->email, $request->password));
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
            return $this->validationFailed($validator);
        }

        return $this->attempt(fn () => $this->auth->firebaseLogin($request->firebase_token));
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
            return $this->validationFailed($validator);
        }

        return $this->attempt(function () use ($request) {
            $this->auth->requestOtp($request->phone);

            return ["message" => "OTP sent"];
        });
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
            return $this->validationFailed($validator);
        }

        return $this->attempt(fn () => $this->auth->otpLogin($request->phone, (string) $request->otp));
    }

    /**
     * Logout - revoke token
     */
    public function logout(Request $request)
    {
        $this->auth->logout($request->user());

        return response()->json(["message" => "Logged out"]);
    }

    /**
     * Delete the authenticated user's account (anonymised; see Identity\Application\AccountDeletion).
     */
    public function deleteAccount(Request $request, AccountDeletion $deletion)
    {
        return $this->attempt(function () use ($request, $deletion) {
            $deletion->delete($request->user());

            return ["message" => "Account deleted."];
        });
    }

    /**
     * Get current user profile
     */
    public function me(Request $request)
    {
        return response()->json($this->auth->me($request->user()));
    }

    private function validationFailed(\Illuminate\Contracts\Validation\Validator $validator)
    {
        return response()->json(
            [
                "error" => "Validation failed",
                "message" => $validator->errors(),
            ],
            422,
        );
    }

    /** Runs an Identity use case; a refusal becomes its exact status and body. */
    private function attempt(callable $useCase)
    {
        try {
            return response()->json($useCase());
        } catch (IdentityRequestRejected $e) {
            return response()->json($e->body, $e->status);
        }
    }
}
