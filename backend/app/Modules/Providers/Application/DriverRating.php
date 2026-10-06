<?php

namespace App\Modules\Providers\Application;

use App\Models\DriverHire;
use App\Models\DriverProfile;
use App\Models\HireRating;
use App\Models\Ride;
use App\Models\RideRating;
use App\Modules\Providers\Contracts\ProviderReputation;
use Illuminate\Support\Facades\DB;

/** A driver's public rating: average of what riders and hire customers gave them. */
class DriverRating implements ProviderReputation
{
    public function refreshProviderRating(int $providerId): void
    {
        self::refresh($providerId);
    }

    public function providerRating(int $providerId): array
    {
        $profile = DriverProfile::where('user_id', $providerId)->first(['rating_avg', 'rating_count']);

        return ['rating_avg' => (float) ($profile->rating_avg ?? 0), 'rating_count' => (int) ($profile->rating_count ?? 0)];
    }

    public static function refresh(int $driverId): void
    {
        $profile = DriverProfile::where('user_id', $driverId)->first();
        if (!$profile) {
            return;
        }

        $rides = RideRating::where('to_user_id', $driverId)
            ->whereIn('ride_id', Ride::where('driver_id', $driverId)->select('id'))
            ->select('stars');
        $hires = HireRating::where('to_user_id', $driverId)
            ->whereIn('driver_hire_id', DriverHire::where('driver_id', $driverId)->select('id'))
            ->select('stars');
        $stats = DB::query()->fromSub($rides->unionAll($hires), 'r')->selectRaw('AVG(stars) as avg, COUNT(*) as n')->first();

        $profile->forceFill(['rating_avg' => round((float) $stats->avg, 1), 'rating_count' => (int) $stats->n])->save();
    }
}
