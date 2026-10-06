<?php

namespace App\Modules\Locations\Contracts;

/**
 * Where Jali works (S10.4): active cities with per-city service switches and
 * setting overrides, and special zones (airport, stadium…) reused by airport
 * queues, pickup points and heatmaps. When no city is active, every place is
 * served (areas switched off).
 */
interface ServiceAreas
{
    public const SERVICES = ['rides', 'hire', 'rental', 'shared', 'bus', 'cargo'];

    /**
     * @return array{served: bool, area: ?array{id: int, name: string}, message: ?string}
     */
    public function availability(float $lat, float $lng, string $service): array;

    /** The active city containing the point, with its overrides, or null. */
    public function cityAt(float $lat, float $lng): ?array;

    /** Active zones containing the point, optionally of one type. */
    public function zonesAt(float $lat, float $lng, ?string $type = null): array;

    /** All active zones (id, name, zone_type, city_id, polygon), optionally of one type. */
    public function zones(?string $type = null): array;
}
