<?php

namespace App\Modules\Pricing\Contracts;

/**
 * Shared platform pricing policy read by rides, hire, payments and locations.
 * Backed by platform_settings['rides'] merged over code defaults
 * (App\Modules\Pricing\Application\RideSettings). Read-only port: admin
 * updates still go through RideSettings::update().
 */
interface PricingPolicy
{
    /** Full effective settings (defaults overridden by saved values). */
    public function settings(): array;

    /** Hire-a-driver limits and booking rules (settings()['hire']). */
    public function hireSettings(): array;

    /** Per-km/min-fare guardrails for one vehicle class (falls back to `car`). */
    public function vehicleClassLimits(string $class): array;
}
