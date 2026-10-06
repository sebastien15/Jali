<?php

namespace App\Services\Auth;

use App\Services\Sms\SmsService;
use Illuminate\Support\Facades\Cache;

/**
 * One-time sign-in codes sent by SMS.
 *
 * - Random 6-digit code, stored only as a hash, valid for TTL_MINUTES.
 * - At most MAX_ATTEMPTS wrong tries, then the code is burned.
 * - A code works once.
 * - The fixed development code (OTP_DEV_CODE) is honoured ONLY in the local
 *   and testing environments — never in production or staging.
 */
class OtpService
{
    public const TTL_MINUTES = 10;
    public const MAX_ATTEMPTS = 5;

    public function __construct(private SmsService $sms)
    {
    }

    /** Rwanda numbers in one format: 0788…, 788…, 250788…, +250 788 … → +250788… */
    public static function normalizePhone(string $phone): ?string
    {
        $digits = preg_replace('/\D/', '', $phone);
        if (preg_match('/^(?:250|0)?(7\d{8})$/', $digits, $m)) {
            return '+250' . $m[1];
        }
        // Other countries: keep international numbers as typed (E.164)
        return str_starts_with(trim($phone), '+') && strlen($digits) >= 8 && strlen($digits) <= 15 ? '+' . $digits : null;
    }

    public function devCode(): ?string
    {
        $code = (string) config('services.otp.dev_code');

        return $code !== '' && app()->environment('local', 'testing') ? $code : null;
    }

    /** Whether codes can be delivered at all in this environment */
    public function available(): bool
    {
        return $this->devCode() !== null || $this->sms->canSend();
    }

    /** Create a new code (replacing any previous one) and send it. Returns false when sending failed. */
    public function send(string $phone): bool
    {
        $code = $this->devCode() ?? str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        Cache::put($this->key($phone), ['hash' => hash('sha256', $phone . '|' . $code), 'attempts' => 0],
            now()->addMinutes(self::TTL_MINUTES));

        if ($this->devCode() !== null) {
            return true;
        }

        return $this->sms->send($phone, "Your Jali code is $code. It expires in " . self::TTL_MINUTES . " minutes. Never share it.");
    }

    /** True once for the right code; wrong tries count towards MAX_ATTEMPTS. */
    public function verify(string $phone, string $code): bool
    {
        $key = $this->key($phone);
        $entry = Cache::get($key);
        if (!is_array($entry)) {
            return false;
        }
        if (hash_equals($entry['hash'], hash('sha256', $phone . '|' . trim($code)))) {
            Cache::forget($key);

            return true;
        }

        $entry['attempts']++;
        if ($entry['attempts'] >= self::MAX_ATTEMPTS) {
            Cache::forget($key);
        } else {
            Cache::put($key, $entry, now()->addMinutes(self::TTL_MINUTES));
        }

        return false;
    }

    private function key(string $phone): string
    {
        return 'otp:' . $phone;
    }
}
