<?php

namespace App\Modules\ServiceAccess\Contracts;

use App\Models\User;

/**
 * One server answer to "which services can this account see, use and offer
 * here, on this app version?" (S23.1, runbook M06). Shared by navigation
 * (`GET /me/service-access`) and every new-intake path. A client persona is
 * never an input. Existing work (history, active rides/hires/rentals,
 * support) is never gated here.
 */
interface ServiceAccess
{
    public const VERSION = 1;
    public const SERVICES = ['rides', 'hire', 'rental', 'shared', 'bus', 'cargo'];

    /** @return array{version: int, services: array<int, array>} */
    public function forUser(User $user, ?float $lat = null, ?float $lng = null, ?string $appVersion = null): array;

    /**
     * Throws (403, reason_code) when the service is not taking new requests
     * (not released, paused, or this app version is too old).
     */
    public function assertAcceptingNew(string $service, ?string $appVersion = null): void;
}
