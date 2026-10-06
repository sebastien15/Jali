<?php

namespace App\Services\Fx;

use App\Models\PlatformSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Approximate prices in the visitor's home currency (story S9.4).
 * Rates refresh at most once a day from a free public API and are kept in
 * platform_settings('fx'); older than 3 days → considered stale and hidden.
 */
class ExchangeRates
{
    public const KEY = 'fx';
    public const SOURCE = 'https://open.er-api.com/v6/latest/RWF';
    public const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES'];
    public const STALE_DAYS = 3;

    public function current(): array
    {
        $saved = PlatformSetting::where('key', self::KEY)->value('value');
        if (!is_array($saved) || now()->diffInHours(\Carbon\Carbon::parse($saved['fetched_at'] ?? '2000-01-01'), true) >= 24) {
            $saved = $this->refresh() ?? $saved;
        }
        $fetchedAt = is_array($saved) ? ($saved['fetched_at'] ?? null) : null;
        $stale = !$fetchedAt || \Carbon\Carbon::parse($fetchedAt)->lt(now()->subDays(self::STALE_DAYS));

        return [
            'base' => 'RWF',
            'rates' => $stale ? null : ($saved['rates'] ?? null),
            'fetched_at' => $fetchedAt,
            'stale' => $stale,
        ];
    }

    /** Fetch and store; null when the source is unreachable (keep the last good rates) */
    public function refresh(): ?array
    {
        try {
            $res = Http::timeout(8)->acceptJson()->get(self::SOURCE);
            $rates = $res->json('rates');
            if (!$res->successful() || !is_array($rates)) {
                return null;
            }
            $value = [
                'rates' => array_map('floatval', array_intersect_key($rates, array_flip(self::CURRENCIES))),
                'fetched_at' => now()->toIso8601String(),
            ];
            PlatformSetting::updateOrCreate(['key' => self::KEY], ['value' => $value]);

            return $value;
        } catch (\Throwable $e) {
            Log::warning('[FX] refresh failed: ' . $e->getMessage());

            return null;
        }
    }
}
