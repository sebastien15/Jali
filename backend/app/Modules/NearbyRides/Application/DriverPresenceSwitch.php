<?php

namespace App\Modules\NearbyRides\Application;

use App\Models\DriverPresence;
use App\Models\User;
use App\Modules\Pricing\Contracts\PricingPolicy;
use App\Modules\Providers\Contracts\ProviderEligibility;

/**
 * Online/offline switch and location heartbeat for rides (story S5.1). The
 * only writer of driver_presence (user_id primary key, one row per driver).
 * Input is already validated by the transport adapter.
 */
class DriverPresenceSwitch
{
    public function __construct(private ProviderEligibility $eligibility, private PricingPolicy $pricing)
    {
    }

    /** POST /driver/presence { online, lat?, lng?, heading? } — returns the response payload */
    public function update(User $user, array $validated): array
    {
        $presence = DriverPresence::firstOrNew(['user_id' => $user->id]);

        if (!$validated['online']) {
            $presence->fill(['is_online' => false, 'online_since' => null])->save();

            return $this->payload($user, $presence);
        }

        $blockers = $this->eligibility->goOnlineBlockers($user);
        if ($blockers) {
            $presence->fill(['is_online' => false, 'online_since' => null])->save();

            return $this->payload($user, $presence, $blockers);
        }

        $vehicle = $user->vehicles()->where('is_active', true)->first();
        $presence->fill([
            'vehicle_id'   => $vehicle->id,
            'is_online'    => true,
            'lat'          => $validated['lat'],
            'lng'          => $validated['lng'],
            'heading'      => $validated['heading'] ?? null,
            'last_seen_at' => now(),
            'online_since' => $presence->is_online && $presence->online_since ? $presence->online_since : now(),
        ])->save();

        return $this->payload($user, $presence, []);
    }

    /** GET /driver/presence (and every update) */
    public function payload(User $user, ?DriverPresence $presence = null, ?array $blockers = null): array
    {
        $presence ??= DriverPresence::find($user->id);
        $live = $presence && DriverPresence::live()->whereKey($user->id)->exists();

        return [
            'online'          => $live,
            'online_since'    => $live ? $presence->online_since?->toIso8601String() : null,
            'blocked_reasons' => $blockers ?? $this->eligibility->goOnlineBlockers($user),
        ];
    }

    /** rides:expire-presence — drivers without a heartbeat for presence_ttl_sec go offline; returns how many */
    public function expireStale(): int
    {
        $ttl = (int) $this->pricing->settings()['presence_ttl_sec'];

        return DriverPresence::where('is_online', true)
            ->where(fn ($q) => $q->whereNull('last_seen_at')->orWhere('last_seen_at', '<', now()->subSeconds($ttl)))
            ->update(['is_online' => false, 'online_since' => null]);
    }
}
