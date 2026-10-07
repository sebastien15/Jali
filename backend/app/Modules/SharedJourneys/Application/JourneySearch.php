<?php

namespace App\Modules\SharedJourneys\Application;

use App\Models\JourneyStop;
use App\Models\PrivateSeat;
use Carbon\Carbon;
use Illuminate\Support\Str;

/**
 * Find journeys that pass through my origin before my destination (S25.3):
 * a driver going Kigali → Muhanga → Huye matches Kigali → Muhanga and
 * Muhanga → Huye. Places match by name (town or station), case-insensitive.
 */
class JourneySearch
{
    public const TZ = 'Africa/Kigali';

    /** @return array{data: array, nearby_dates: array} */
    public function search(string $from, string $to, string $date, int $seats = 1): array
    {
        $results = $this->forDate($from, $to, $date, $seats);
        $nearby = [];
        if (!$results) {
            // Empty: suggest the next days that have a journey
            $day = Carbon::parse($date, self::TZ);
            for ($i = 1; $i <= 7 && count($nearby) < 3; $i++) {
                $d = $day->copy()->addDays($i)->toDateString();
                if ($n = count($this->forDate($from, $to, $d, $seats))) {
                    $nearby[] = ['date' => $d, 'journeys' => $n];
                }
            }
        }

        return ['data' => $results, 'nearby_dates' => $nearby];
    }

    private function forDate(string $from, string $to, string $date, int $seats): array
    {
        $today = Carbon::now(self::TZ)->toDateString();
        if ($date < $today) {
            return [];
        }
        $listings = PrivateSeat::with('stops', 'owner.driverProfile')->where('active', true)
            ->where(fn ($q) => $q->whereNull('date')->orWhere('date', $date))
            ->get();

        $out = [];
        foreach ($listings as $listing) {
            $match = self::match($listing, $from, $to);
            if (!$match) {
                continue;
            }
            [$a, $b] = $match;
            // Departures already gone today are not offered
            if ($date === $today && $a['time'] <= Carbon::now(self::TZ)->format('H:i')) {
                continue;
            }
            $left = SegmentSeats::left($listing, $date, $a['seq'], $b['seq']);
            if ($left < $seats) {
                continue;
            }
            $profile = $listing->owner?->driverProfile;
            $out[] = [
                'listing_id'          => $listing->id,
                'date'                => $date,
                'driver'              => ['name' => $listing->driver, 'rating' => (float) ($profile?->rating_avg ?? $listing->rating ?? 0)],
                'from'                => $a,
                'to'                  => $b,
                'route'               => $listing->stops->isNotEmpty() ? $listing->stops->pluck('name')->all() : [$listing->from, $listing->to],
                'fare'                => $listing->segmentFare($a['seq'], $b['seq']),
                'seats_left'          => $left,
                'pickup_point'        => $a['seq'] === 0 ? ($listing->pickup_station ?: $a['name']) : $a['name'],
                'allow_custom_pickup' => (bool) $listing->allow_custom_pickup,
                'custom_pickup_fee'   => (int) ($listing->custom_pickup_fee ?? 0),
                'amenities'           => $listing->amenities ?? [],
            ];
        }
        usort($out, fn ($x, $y) => strcmp($x['from']['time'], $y['from']['time']) ?: $x['fare'] <=> $y['fare']);

        return $out;
    }

    /** The boarding and alighting stops, or null when the journey doesn't go from → to in that order */
    public static function match(PrivateSeat $listing, string $from, string $to): ?array
    {
        $stops = $listing->stops->isNotEmpty()
            ? $listing->stops->map(fn (JourneyStop $s) => ['seq' => $s->seq, 'name' => $s->name, 'time' => $s->time])->values()->all()
            : [['seq' => 0, 'name' => $listing->from, 'time' => (string) $listing->dep], ['seq' => 1, 'name' => $listing->to, 'time' => null]];
        $same = fn (?string $a, string $b) => $a !== null && Str::lower(trim($a)) === Str::lower(trim($b));
        foreach ($stops as $i => $s) {
            if (!$same($s['name'], $from)) {
                continue;
            }
            for ($j = $i + 1; $j < count($stops); $j++) {
                if ($same($stops[$j]['name'], $to)) {
                    return [$s, $stops[$j]];
                }
            }
        }

        return null;
    }
}
