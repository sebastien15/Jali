<?php

namespace App\Modules\Locations\Application;

use App\Models\ActivityLog;
use App\Models\ServiceArea;
use App\Models\User;
use App\Modules\Locations\Contracts\ServiceAreas;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Superadmin write path for service areas and zones (S10.4). A shape comes as
 * a list of [lat, lng] points, a GeoJSON polygon (uploaded file contents) or a
 * circle (centre + radius), and is always stored as [lat, lng] points.
 */
class ServiceAreaAdmin
{
    /** Ride settings a city may override (Pricing keys), plus `services` switches. */
    public const OVERRIDABLE = ['commission_pct', 'cancel_fee', 'free_wait_min', 'nearby_radius_km', 'broadcast_max_drivers', 'vehicle_classes'];

    public static function rules(bool $creating): array
    {
        $rules = [
            'name'      => ($creating ? 'required' : 'sometimes') . '|string|max:80',
            'kind'      => ($creating ? 'required' : 'sometimes') . '|in:city,zone',
            'zone_type' => ['nullable', 'required_if:kind,zone', Rule::in(ServiceArea::ZONE_TYPES)],
            'parent_id' => 'nullable|integer|exists:service_areas,id',
            'active'    => 'sometimes|boolean',
            'polygon'   => 'sometimes|array|min:3|max:500',
            'polygon.*' => 'array|size:2',
            'polygon.*.0' => 'numeric|between:-90,90',
            'polygon.*.1' => 'numeric|between:-180,180',
            'geojson'   => 'sometimes',
            'circle'           => 'sometimes|array',
            'circle.lat'       => 'required_with:circle|numeric|between:-90,90',
            'circle.lng'       => 'required_with:circle|numeric|between:-180,180',
            'circle.radius_km' => 'required_with:circle|numeric|min:0.1|max:100',
            'overrides'                       => 'sometimes|nullable|array',
            'overrides.commission_pct'        => 'sometimes|nullable|numeric|min:0|max:50',
            'overrides.cancel_fee'            => 'sometimes|nullable|integer|min:0|max:10000',
            'overrides.free_wait_min'         => 'sometimes|nullable|integer|min:0|max:30',
            'overrides.nearby_radius_km'      => 'sometimes|nullable|numeric|min:0.5|max:50',
            'overrides.broadcast_max_drivers' => 'sometimes|nullable|integer|min:1|max:20',
            'overrides.vehicle_classes'       => 'sometimes|nullable|array',
            'overrides.services'              => 'sometimes|nullable|array',
        ];
        foreach (['moto', 'car', 'comfort', 'van'] as $class) {
            $rules["overrides.vehicle_classes.$class"] = 'sometimes|array';
            $rules["overrides.vehicle_classes.$class.per_km_min"] = "required_with:overrides.vehicle_classes.$class|integer|min:0";
            $rules["overrides.vehicle_classes.$class.per_km_max"] = "required_with:overrides.vehicle_classes.$class|integer|gte:overrides.vehicle_classes.$class.per_km_min";
            $rules["overrides.vehicle_classes.$class.min_fare_max"] = "required_with:overrides.vehicle_classes.$class|integer|min:0";
        }
        foreach (ServiceAreas::SERVICES as $service) {
            $rules["overrides.services.$service"] = 'sometimes|boolean';
        }

        return $rules;
    }

    public function list(): array
    {
        return ServiceArea::with('parent:id,name')->withCount('zones')
            ->orderByRaw("CASE WHEN kind = 'city' THEN 0 ELSE 1 END")->orderByDesc('active')->orderBy('name')
            ->get()->map(fn ($a) => self::present($a))->all();
    }

    public function create(array $data, User $by): ServiceArea
    {
        $polygon = $this->shape($data);
        if ($polygon === null) {
            throw ValidationException::withMessages(['polygon' => 'Draw the area, upload a GeoJSON polygon, or give a centre and radius.']);
        }
        $area = new ServiceArea(['kind' => $data['kind'], 'updated_by' => $by->id]);
        $this->fill($area, $data, $polygon);
        $area->save();
        ServiceAreaDirectory::forget();
        $this->log($by, 'service_area_created', $area, null);

        return $area;
    }

    public function update(ServiceArea $area, array $data, User $by): ServiceArea
    {
        $old = self::present($area);
        $this->fill($area, $data, $this->shape($data));
        $area->updated_by = $by->id;
        $area->save();
        ServiceAreaDirectory::forget();
        $this->log($by, 'service_area_updated', $area, $old);

        return $area;
    }

    public function delete(ServiceArea $area, User $by): void
    {
        if ($area->zones()->exists()) {
            throw new HttpException(409, 'Delete or move the zones inside this city first.');
        }
        $old = self::present($area);
        $area->delete();
        ServiceAreaDirectory::forget();
        $this->log($by, 'service_area_deleted', $area, $old);
    }

    public static function present(ServiceArea $a): array
    {
        $points = $a->polygon ?? [];
        $n = max(1, count($points));

        return [
            'id'          => $a->id,
            'name'        => $a->name,
            'kind'        => $a->kind,
            'zone_type'   => $a->zone_type,
            'parent_id'   => $a->parent_id,
            'parent_name' => $a->parent?->name,
            'active'      => (bool) $a->active,
            'polygon'     => $points,
            'center'      => ['lat' => round(array_sum(array_column($points, 0)) / $n, 6), 'lng' => round(array_sum(array_column($points, 1)) / $n, 6)],
            'overrides'   => (object) ($a->overrides ?? []),
            'zones_count' => (int) ($a->zones_count ?? $a->zones()->count()),
            'updated_at'  => $a->updated_at?->toIso8601String(),
        ];
    }

    private function fill(ServiceArea $area, array $data, ?array $polygon): void
    {
        $kind = $data['kind'] ?? $area->kind;
        $parentId = array_key_exists('parent_id', $data) ? $data['parent_id'] : $area->parent_id;
        if ($kind === ServiceArea::CITY) {
            $parentId = null;
            $data['zone_type'] = null;
        } elseif ($parentId !== null) {
            $parent = ServiceArea::find($parentId);
            if (!$parent || $parent->kind !== ServiceArea::CITY || $parent->id === $area->id) {
                throw ValidationException::withMessages(['parent_id' => 'A zone must belong to a city.']);
            }
        }
        $area->kind = $kind;
        $area->parent_id = $parentId;
        foreach (['name', 'zone_type', 'active'] as $key) {
            if (array_key_exists($key, $data)) {
                $area->{$key} = $data[$key];
            }
        }
        if (array_key_exists('overrides', $data)) {
            $area->overrides = self::cleanOverrides($data['overrides'] ?? []);
        }
        if ($polygon !== null) {
            $lats = array_column($polygon, 0);
            $lngs = array_column($polygon, 1);
            $area->polygon = $polygon;
            $area->min_lat = min($lats);
            $area->max_lat = max($lats);
            $area->min_lng = min($lngs);
            $area->max_lng = max($lngs);
        }
    }

    /** Drop empty values so the global setting applies. */
    private static function cleanOverrides(array $overrides): array
    {
        $out = [];
        foreach (self::OVERRIDABLE as $key) {
            if (isset($overrides[$key]) && $overrides[$key] !== []) {
                $out[$key] = $overrides[$key];
            }
        }
        $services = array_intersect_key((array) ($overrides['services'] ?? []), array_flip(ServiceAreas::SERVICES));
        if ($services) {
            $out['services'] = array_map('boolval', $services);
        }

        return $out;
    }

    /** @return array<int, array{0: float, 1: float}>|null */
    private function shape(array $data): ?array
    {
        if (!empty($data['polygon'])) {
            return array_map(fn ($p) => [round((float) $p[0], 6), round((float) $p[1], 6)], array_values($data['polygon']));
        }
        if (!empty($data['circle'])) {
            return self::circle((float) $data['circle']['lat'], (float) $data['circle']['lng'], (float) $data['circle']['radius_km']);
        }
        if (!empty($data['geojson'])) {
            return self::fromGeoJson($data['geojson']);
        }

        return null;
    }

    public static function circle(float $lat, float $lng, float $radiusKm, int $points = 24): array
    {
        $dLat = $radiusKm / 111.0;
        $dLng = $radiusKm / (111.0 * max(0.01, cos(deg2rad($lat))));
        $out = [];
        for ($i = 0; $i < $points; $i++) {
            $a = 2 * M_PI * $i / $points;
            $out[] = [round($lat + $dLat * sin($a), 6), round($lng + $dLng * cos($a), 6)];
        }

        return $out;
    }

    /** First polygon of a GeoJSON Polygon / MultiPolygon / Feature / FeatureCollection ([lng, lat] → [lat, lng]). */
    public static function fromGeoJson(mixed $geojson): array
    {
        $g = is_string($geojson) ? json_decode($geojson, true) : $geojson;
        while (is_array($g) && in_array($g['type'] ?? null, ['FeatureCollection', 'Feature'], true)) {
            $g = ($g['type'] === 'Feature') ? ($g['geometry'] ?? null) : ($g['features'][0] ?? null);
        }
        $ring = match ($g['type'] ?? null) {
            'Polygon'      => $g['coordinates'][0] ?? null,
            'MultiPolygon' => $g['coordinates'][0][0] ?? null,
            default        => null,
        };
        if (!is_array($ring) || count($ring) < 4) {
            throw ValidationException::withMessages(['geojson' => 'Upload a GeoJSON Polygon (or a Feature with one).']);
        }
        if ($ring[0] == end($ring)) {
            array_pop($ring);   // GeoJSON repeats the first point
        }
        $points = [];
        foreach (array_slice($ring, 0, 500) as $p) {
            if (!is_array($p) || !is_numeric($p[0] ?? null) || !is_numeric($p[1] ?? null) || abs($p[1]) > 90 || abs($p[0]) > 180) {
                throw ValidationException::withMessages(['geojson' => 'The GeoJSON has an invalid point.']);
            }
            $points[] = [round((float) $p[1], 6), round((float) $p[0], 6)];
        }

        return $points;
    }

    private function log(User $by, string $action, ServiceArea $area, ?array $old): void
    {
        ActivityLog::create([
            'admin_id'    => $by->id,
            'action'      => $action,
            'entity_type' => 'service_area',
            'entity_id'   => $area->id,
            'details'     => ['old' => $old, 'new' => $action === 'service_area_deleted' ? null : self::present($area->fresh() ?? $area)],
        ]);
    }
}
