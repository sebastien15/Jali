<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DriverProfile;
use App\Models\Ride;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Ride metrics for the analytics screen (story S10.3). Requires view-analytics.
 * Buckets are Kigali days or ISO weeks (Monday start). Aggregation runs in PHP
 * so it behaves the same on SQLite and MySQL; the window is capped at 92 days.
 */
class RideAnalyticsController extends Controller
{
    private const TZ = 'Africa/Kigali';
    private const MAX_DAYS = 92;
    private const TOP = 5;
    /** A driver needs this many completed trips in the window to rank by rating */
    private const MIN_TRIPS_FOR_RATING = 3;

    /** GET /analytics/rides?period=day|week&from&to */
    public function index(Request $request)
    {
        $user = $request->user();
        abort_unless($user && $user->hasPermission('view-analytics'), 403, 'You do not have permission to view analytics.');

        $data = $request->validate([
            'period' => ['sometimes', 'in:day,week'],
            'from'   => ['sometimes', 'date'],
            'to'     => ['sometimes', 'date'],
        ]);
        $period = $data['period'] ?? 'day';
        $to = isset($data['to']) ? Carbon::parse($data['to'], self::TZ)->endOfDay() : now(self::TZ)->endOfDay();
        $from = isset($data['from']) ? Carbon::parse($data['from'], self::TZ)->startOfDay() : $to->copy()->subDays(29)->startOfDay();
        if ($from->gt($to)) {
            throw ValidationException::withMessages(['from' => 'The start date must be before the end date.']);
        }
        if ($from->diffInDays($to) >= self::MAX_DAYS) {
            throw ValidationException::withMessages(['from' => 'Pick a range of ' . self::MAX_DAYS . ' days or less.']);
        }

        $rides = Ride::query()
            ->whereBetween('requested_at', [$from->copy()->utc(), $to->copy()->utc()])
            ->get(['id', 'status', 'driver_id', 'vehicle_class', 'requested_at', 'accepted_at', 'arrived_at',
                'est_distance_km', 'final_fare', 'commission']);

        $grouped = $rides->groupBy(fn (Ride $r) => $this->bucketKey($r->requested_at, $period));
        $series = $this->buckets($from, $to, $period)
            ->map(fn (string $key) => ['bucket' => $key] + $this->metrics($grouped->get($key, collect())))
            ->values();

        return response()->json([
            'period'               => $period,
            'from'                 => $from->toDateString(),
            'to'                   => $to->toDateString(),
            'totals'               => $this->metrics($rides),
            'series'               => $series,
            'fare_per_km_by_class' => (object) $rides->where('status', Ride::COMPLETED)->groupBy('vehicle_class')
                ->map(fn (Collection $group) => $this->farePerKm($group))->filter(fn ($v) => $v !== null)->all(),
            'top_drivers'          => $this->topDrivers($rides->where('status', Ride::COMPLETED)),
        ]);
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private function metrics(Collection $rides): array
    {
        $requested = $rides->count();
        $completed = $rides->where('status', Ride::COMPLETED);
        $byRider = $rides->where('status', Ride::CANCELLED_BY_RIDER)->count();
        $byDriver = $rides->where('status', Ride::CANCELLED_BY_DRIVER)->count();
        $expired = $rides->where('status', Ride::EXPIRED)->count();
        $pickups = $rides->filter(fn (Ride $r) => $r->accepted_at && $r->arrived_at)
            ->map(fn (Ride $r) => $r->accepted_at->diffInSeconds($r->arrived_at) / 60);

        return [
            'requested'           => $requested,
            'completed'           => $completed->count(),
            'cancelled_by_rider'  => $byRider,
            'cancelled_by_driver' => $byDriver,
            'expired'             => $expired,
            'rider_cancel_rate'   => $this->rate($byRider, $requested),
            'driver_cancel_rate'  => $this->rate($byDriver, $requested),
            'expired_rate'        => $this->rate($expired, $requested),
            'gmv'                 => (int) $completed->sum('final_fare'),
            'commission'          => (int) $completed->sum('commission'),
            'avg_pickup_minutes'  => $pickups->isEmpty() ? null : round($pickups->avg(), 1),
        ];
    }

    private function rate(int $part, int $whole): float
    {
        return $whole === 0 ? 0.0 : round($part / $whole, 3);
    }

    /** Average of final fare / estimated km across completed rides */
    private function farePerKm(Collection $rides): ?int
    {
        $km = $rides->sum('est_distance_km');

        return $km > 0 ? (int) round($rides->sum('final_fare') / $km) : null;
    }

    private function topDrivers(Collection $completed): array
    {
        $trips = $completed->whereNotNull('driver_id')->countBy('driver_id');
        $users = User::whereIn('id', $trips->keys())->pluck('name', 'id');
        $profiles = DriverProfile::whereIn('user_id', $trips->keys())->get(['user_id', 'rating_avg', 'rating_count'])->keyBy('user_id');

        $rows = $trips->map(function (int $count, $id) use ($users, $profiles) {
            $profile = $profiles->get($id);

            return [
                'id'           => (int) $id,
                'name'         => $users->get($id),
                'trips'        => $count,
                'rating'       => $profile?->rating_count ? (float) $profile->rating_avg : null,
                'rating_count' => (int) ($profile?->rating_count ?? 0),
            ];
        })->values();

        return [
            'by_trips'  => $rows->sortBy([['trips', 'desc'], ['id', 'asc']])->take(self::TOP)->values(),
            'by_rating' => $rows->filter(fn ($r) => $r['rating'] !== null && $r['trips'] >= self::MIN_TRIPS_FOR_RATING)
                ->sortBy([['rating', 'desc'], ['trips', 'desc']])->take(self::TOP)->values(),
        ];
    }

    /** Every bucket key in the window, so days with no rides still show as zero */
    private function buckets(Carbon $from, Carbon $to, string $period): Collection
    {
        $keys = collect();
        for ($day = $from->copy(); $day->lte($to); $day->addDay()) {
            $keys->push($this->bucketKey($day, $period));
        }

        return $keys->unique()->values();
    }

    private function bucketKey(?Carbon $at, string $period): ?string
    {
        if (! $at) {
            return null;
        }
        $local = $at->copy()->setTimezone(self::TZ);

        return $period === 'week' ? $local->startOfWeek(Carbon::MONDAY)->toDateString() : $local->toDateString();
    }
}
