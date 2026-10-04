<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * Sends SMS through the driver configured in services.sms.driver.
 *
 * Only the "log" driver exists today (writes the message to the log, for
 * local development). Plug a real provider in here before enabling phone
 * login in production.
 */
class SmsSender
{
    public function isConfigured(): bool
    {
        return config('services.sms.driver') !== 'log' || !app()->isProduction();
    }

    public function send(string $phone, string $message): void
    {
        match (config('services.sms.driver')) {
            'log' => Log::info('[SMS] ' . $phone . ': ' . $message),
            default => throw new \RuntimeException('Unsupported SMS driver: ' . config('services.sms.driver')),
        };
    }
}
