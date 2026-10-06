<?php

namespace App\Modules\Notifications\Infrastructure;

use App\Modules\Notifications\Contracts\SmsSender;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Sends SMS through the configured driver (config/services.php `sms`):
 * - `africastalking`: Africa's Talking messaging API (Rwanda numbers)
 * - `log`: writes the message to the log — local and testing environments only
 */
class SmsService implements SmsSender
{
    public const AFRICASTALKING_ENDPOINT = 'https://api.africastalking.com/version1/messaging';

    /** Can this environment deliver real SMS? */
    public function canSend(): bool
    {
        $config = config('services.sms');

        return match ($config['driver'] ?? 'log') {
            'africastalking' => !empty($config['africastalking']['username']) && !empty($config['africastalking']['api_key']),
            'log'            => app()->environment('local', 'testing'),
            default          => false,
        };
    }

    public function send(string $phone, string $message): bool
    {
        $config = config('services.sms');
        if (($config['driver'] ?? 'log') === 'log') {
            Log::info('[SMS] ' . $phone . ': ' . $message);

            return true;
        }

        $at = $config['africastalking'];
        try {
            $response = Http::asForm()->acceptJson()
                ->withHeaders(['apiKey' => $at['api_key']])
                ->timeout(10)
                ->post(self::AFRICASTALKING_ENDPOINT, array_filter([
                    'username' => $at['username'],
                    'to'       => $phone,
                    'message'  => $message,
                    'from'     => $at['sender_id'] ?: null,
                ]));
            $status = $response->json('SMSMessageData.Recipients.0.status');
            if (!$response->successful() || !in_array($status, ['Success', 'Sent', null], true)) {
                Log::warning('[SMS] Africa\'s Talking rejected the message', ['phone' => $phone, 'status' => $response->status(), 'recipient' => $status]);

                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning('[SMS] Africa\'s Talking request failed', ['phone' => $phone, 'error' => $e->getMessage()]);

            return false;
        }
    }
}
