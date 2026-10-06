<?php

namespace App\Modules\Providers\Application;

use App\Modules\Providers\Contracts\ProviderDisplay;

/** Public short name shared by rides, hires and safety (was NearbyDrivers::displayName). */
class DisplayName implements ProviderDisplay
{
    public function displayName(?string $name): string
    {
        return self::format($name);
    }

    /** "Jean Paul Habimana" → "Jean H." */
    public static function format(?string $name): string
    {
        $parts = preg_split('/\s+/', trim((string) $name)) ?: [];
        if (!$parts || $parts[0] === '') {
            return 'Driver';
        }
        $first = $parts[0];
        $last = count($parts) > 1 ? ' ' . mb_strtoupper(mb_substr(end($parts), 0, 1)) . '.' : '';

        return $first . $last;
    }
}
