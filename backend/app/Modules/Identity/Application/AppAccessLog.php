<?php

namespace App\Modules\Identity\Application;

use App\Models\AppAccess;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * App opens (POST /track-access, public) and the staff views of them
 * (/admin/app-accesses, /admin/access-stats; manage-admins).
 * Input is validated by the transport.
 */
class AppAccessLog
{
    /** $lat/$lng are the raw request values; the district is looked up only when both were filled. */
    public function record(string $platform, ?int $userId, ?string $ip, mixed $lat, mixed $lng, bool $hasCoordinates): void
    {
        $district = null;
        if ($hasCoordinates) {
            // ~1 km grid cache so app opens don't each hit Nominatim (1 req/s policy).
            $key = sprintf('district:%.2f,%.2f', $lat, $lng);
            $district = Cache::remember($key, now()->addDays(30),
                fn () => $this->districtFromCoords((float) $lat, (float) $lng) ?? '');
            $district = $district ?: null;
        }

        AppAccess::create([
            'platform'   => $platform,
            'user_id'    => $userId,
            'ip_address' => $ip,
            'lat'        => $lat,
            'lng'        => $lng,
            'district'   => $district,
        ]);
    }

    /** @param array{platform?: mixed, from_date?: mixed, to_date?: mixed} $filters only the filled request values */
    public function page(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = AppAccess::with('user')
            ->orderBy('accessed_at', 'desc');

        if (array_key_exists('platform', $filters)) {
            $query->where('platform', $filters['platform']);
        }
        if (array_key_exists('from_date', $filters)) {
            $query->whereDate('accessed_at', '>=', $filters['from_date']);
        }
        if (array_key_exists('to_date', $filters)) {
            $query->whereDate('accessed_at', '<=', $filters['to_date']);
        }

        return $query->paginate($perPage)->through(fn($r) => [
            'id'          => $r->id,
            'platform'    => $r->platform,
            'user_email'  => $r->user?->email,
            'user_name'   => $r->user?->name,
            'ip_address'  => $r->ip_address,
            'district'    => $r->district,
            'accessed_at' => $r->accessed_at,
        ]);
    }

    public function stats(): array
    {
        $totals = AppAccess::selectRaw('platform, COUNT(*) as count')
            ->groupBy('platform')
            ->pluck('count', 'platform');

        $last30 = AppAccess::selectRaw('platform, COUNT(*) as count')
            ->where('accessed_at', '>=', now()->subDays(30))
            ->groupBy('platform')
            ->pluck('count', 'platform');

        return [
            'all_time'     => $totals,
            'last_30_days' => $last30,
        ];
    }

    /**
     * Reverse-geocode via Nominatim to get a district name.
     * Returns null silently on any failure — never blocks the request.
     */
    private function districtFromCoords(float $lat, float $lng): ?string
    {
        try {
            $resp = Http::timeout(3)
                ->withHeaders(['User-Agent' => 'Jali/1.0 contact@jali.rw'])
                ->get('https://nominatim.openstreetmap.org/reverse', [
                    'lat'          => $lat,
                    'lon'          => $lng,
                    'format'       => 'json',
                    'zoom'         => 10,
                    'addressdetails' => 1,
                ]);

            if (!$resp->ok()) return null;

            $addr = $resp->json('address', []);
            // Rwanda: county = district, city / town / village as fallback
            return $addr['county'] ?? $addr['city_district'] ?? $addr['city'] ?? $addr['town'] ?? null;
        } catch (\Throwable) {
            return null;
        }
    }
}
