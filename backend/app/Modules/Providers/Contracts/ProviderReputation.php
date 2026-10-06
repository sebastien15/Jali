<?php

namespace App\Modules\Providers\Contracts;

/**
 * A provider's public rating: one value across every service they work in
 * (rides and hires today). Services store their own rating rows, then ask
 * Providers to recompute; nobody else writes rating_avg/rating_count.
 */
interface ProviderReputation
{
    /** Recompute the provider's rating after a rating was recorded. */
    public function refreshProviderRating(int $providerId): void;

    /** @return array{rating_avg: float, rating_count: int} zeros when the provider has no profile */
    public function providerRating(int $providerId): array;
}
