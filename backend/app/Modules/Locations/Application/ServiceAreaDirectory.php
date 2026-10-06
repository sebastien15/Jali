<?php

namespace App\Modules\Locations\Application;

use App\Models\ServiceArea;
use App\Modules\Locations\Contracts\ServiceAreas;
use Illuminate\Support\Facades\Cache;

/** Point-in-polygon lookups over the active service areas, cached until an admin saves (S10.4). */
class ServiceAreaDirectory implements ServiceAreas
{
    public const CACHE_KEY = 'service_areas:active';

    private const LABELS = [
        'rides' => 'Rides', 'hire' => 'Hire a driver', 'rental' => 'Car rental',
        'shared' => 'Shared journeys', 'bus' => 'Bus tickets', 'cargo' => 'Cargo',
    ];

    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    public function availability(float $lat, float $lng, string $service): array
    {
        $cities = $this->active()['cities'];
        if ($cities === []) {
            return ['served' => true, 'area' => null, 'message' => null];
        }
        $city = $this->cityAt($lat, $lng);
        if (!$city) {
            $names = implode(', ', array_column($cities, 'name'));

            return ['served' => false, 'area' => null,
                'message' => "Not available here yet. Jali currently works in {$names}."];
        }
        $area = ['id' => $city['id'], 'name' => $city['name']];
        if (($city['overrides']['services'][$service] ?? true) === false) {
            $label = self::LABELS[$service] ?? ucfirst($service);

            return ['served' => false, 'area' => $area, 'message' => "{$label} is not available in {$city['name']} yet."];
        }

        return ['served' => true, 'area' => $area, 'message' => null];
    }

    public function cityAt(float $lat, float $lng): ?array
    {
        foreach ($this->active()['cities'] as $city) {
            if (self::contains($city, $lat, $lng)) {
                return $city;
            }
        }

        return null;
    }

    public function zonesAt(float $lat, float $lng, ?string $type = null): array
    {
        return array_values(array_filter($this->zones($type), fn ($z) => self::contains($z, $lat, $lng)));
    }

    public function zones(?string $type = null): array
    {
        $zones = $this->active()['zones'];

        return array_values($type === null ? $zones : array_filter($zones, fn ($z) => $z['zone_type'] === $type));
    }

    /** Ray casting; the bounding box is checked first. */
    public static function contains(array $area, float $lat, float $lng): bool
    {
        [$minLat, $maxLat, $minLng, $maxLng] = $area['bbox'];
        if ($lat < $minLat || $lat > $maxLat || $lng < $minLng || $lng > $maxLng) {
            return false;
        }
        $points = $area['polygon'];
        $inside = false;
        for ($i = 0, $j = count($points) - 1; $i < count($points); $j = $i++) {
            [$yi, $xi] = $points[$i];
            [$yj, $xj] = $points[$j];
            if ((($yi > $lat) !== ($yj > $lat)) && ($lng < ($xj - $xi) * ($lat - $yi) / (($yj - $yi) ?: 1e-12) + $xi)) {
                $inside = !$inside;
            }
        }

        return $inside;
    }

    /** @return array{cities: array, zones: array} */
    private function active(): array
    {
        return Cache::remember(self::CACHE_KEY, 300, function () {
            $rows = ServiceArea::where('active', true)->orderBy('name')->get();
            $map = fn (ServiceArea $a) => [
                'id' => $a->id, 'name' => $a->name, 'zone_type' => $a->zone_type, 'city_id' => $a->parent_id,
                'polygon' => $a->polygon, 'bbox' => [$a->min_lat, $a->max_lat, $a->min_lng, $a->max_lng],
                'overrides' => $a->overrides ?? [],
            ];

            return [
                'cities' => $rows->where('kind', ServiceArea::CITY)->map($map)->values()->all(),
                'zones'  => $rows->where('kind', ServiceArea::ZONE)->map($map)->values()->all(),
            ];
        });
    }
}
