<?php

namespace App\Services\Rides;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Place search and reverse geocoding for "Where to?" (story S3.1).
 * Uses OpenStreetMap Nominatim limited to Rwanda, cached so we stay far below
 * its usage policy (1 req/s). Swap the provider here (e.g. Google Places)
 * without touching the app — the response shape is the contract.
 */
class PlaceSearch
{
    public const BASE = 'https://nominatim.openstreetmap.org';
    private const USER_AGENT = 'Jali/1.0 contact@jali.rw';

    /** @return array<int, array{name: string, address: string, lat: float, lng: float}> */
    public function search(string $query, ?float $nearLat = null, ?float $nearLng = null): array
    {
        $query = trim(preg_replace('/\s+/', ' ', $query));
        $key = 'places:search:' . md5(mb_strtolower($query) . ($nearLat !== null ? round($nearLat, 2) . ',' . round($nearLng, 2) : ''));

        return Cache::remember($key, now()->addDay(), function () use ($query, $nearLat, $nearLng) {
            $params = [
                'q' => $query, 'format' => 'jsonv2', 'countrycodes' => 'rw', 'limit' => 8, 'addressdetails' => 1,
                'accept-language' => app()->getLocale() . ',en',
            ];
            if ($nearLat !== null && $nearLng !== null) {
                // Prefer results around the rider (not a hard limit)
                $params['viewbox'] = implode(',', [$nearLng - 0.15, $nearLat + 0.15, $nearLng + 0.15, $nearLat - 0.15]);
            }

            try {
                $response = Http::timeout(5)->withHeaders(['User-Agent' => self::USER_AGENT])->get(self::BASE . '/search', $params);
            } catch (Throwable) {
                return [];
            }
            if (!$response->ok()) {
                return [];
            }

            return collect($response->json())->map(fn ($r) => [
                'name'    => $r['name'] ?: strtok($r['display_name'], ','),
                'address' => self::shortAddress($r['display_name'] ?? ''),
                'lat'     => (float) $r['lat'],
                'lng'     => (float) $r['lon'],
            ])->unique(fn ($p) => $p['name'] . '|' . round($p['lat'], 3))->values()->all();
        });
    }

    /** @return array{name: string, address: string, lat: float, lng: float}|null */
    public function reverse(float $lat, float $lng): ?array
    {
        $key = 'places:reverse:' . round($lat, 4) . ',' . round($lng, 4);

        return Cache::remember($key, now()->addDay(), function () use ($lat, $lng) {
            try {
                $response = Http::timeout(5)->withHeaders(['User-Agent' => self::USER_AGENT])
                    ->get(self::BASE . '/reverse', ['lat' => $lat, 'lon' => $lng, 'format' => 'jsonv2', 'zoom' => 18,
                        'accept-language' => app()->getLocale() . ',en']);
            } catch (Throwable) {
                return null;
            }
            if (!$response->ok() || !$response->json('display_name')) {
                return null;
            }

            return [
                'name'    => $response->json('name') ?: strtok($response->json('display_name'), ','),
                'address' => self::shortAddress($response->json('display_name')),
                'lat'     => $lat,
                'lng'     => $lng,
            ];
        });
    }

    /** "KN 3 Rd, Kiyovu, Nyarugenge, Kigali, Rwanda" → "KN 3 Rd, Kiyovu, Nyarugenge" */
    public static function shortAddress(string $displayName): string
    {
        $parts = array_map('trim', explode(',', $displayName));
        $parts = array_values(array_filter($parts, fn ($p) => $p !== 'Rwanda' && !preg_match('/^\d{3,}$/', $p)));

        return implode(', ', array_slice($parts, 0, 3));
    }
}
