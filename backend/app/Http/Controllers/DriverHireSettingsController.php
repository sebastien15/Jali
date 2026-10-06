<?php

namespace App\Http\Controllers;

use App\Models\DriverAvailability;
use App\Models\DriverHire;
use App\Models\DriverProfile;
use App\Models\User;
use App\Services\Hire\HireQuote;
use App\Modules\Pricing\Application\RideSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Driver side of Hire a Driver setup: prices and skills (S6.1), weekly hours
 * and blocked dates (S6.2). Requires offer-driver-hire and a verified profile.
 */
class DriverHireSettingsController extends Controller
{
    public const LANGUAGES = ['rw', 'en', 'fr', 'sw', 'other'];

    /** GET /driver/hire-settings */
    public function show(Request $request)
    {
        return response()->json($this->payload($this->driver($request)));
    }

    /** PUT /driver/hire-settings — prices validated against the superadmin limits; skills on the driver profile */
    public function update(Request $request)
    {
        $user = $this->driver($request);
        $validated = $request->validate(HireQuote::rateRules() + [
            'transmissions'    => 'required|array|min:1',
            'transmissions.*'  => ['string', 'distinct', Rule::in(DriverHire::TRANSMISSIONS)],
            'languages'        => 'required|array|min:1',
            'languages.*'      => ['string', 'distinct', Rule::in(self::LANGUAGES)],
            'years_experience' => 'required|integer|min:0|max:60',
        ], HireQuote::rateMessages() + [
            'transmissions.required' => 'Choose at least one: automatic or manual.',
            'languages.required'     => 'Choose at least one language you speak.',
        ]);

        DB::transaction(function () use ($user, $validated) {
            $user->hireSettings()->updateOrCreate(['user_id' => $user->id],
                array_intersect_key($validated, array_flip(['hourly_rate', 'min_hours', 'daily_rate', 'daily_hours', 'overtime_per_hour', 'out_of_town_fee', 'is_active'])));
            $user->driverProfile->update(array_intersect_key($validated, array_flip(['transmissions', 'languages', 'years_experience'])));
        });

        return response()->json($this->payload($user->fresh()));
    }

    /** GET /driver/availability */
    public function availability(Request $request)
    {
        return response()->json($this->availabilityPayload($this->driver($request)));
    }

    /** PUT /driver/availability — replaces the whole calendar */
    public function updateAvailability(Request $request)
    {
        $user = $this->driver($request);
        $validated = $request->validate([
            'weekly'              => 'present|array|max:7',
            'weekly.*.weekday'    => 'required|integer|between:0,6|distinct',
            'weekly.*.start_time' => 'required|date_format:H:i',
            'weekly.*.end_time'   => 'required|date_format:H:i|after:weekly.*.start_time',
            'blocked_dates'       => 'present|array|max:366',
            'blocked_dates.*'     => 'date_format:Y-m-d|distinct',
        ], [
            'weekly.*.end_time.after' => 'The end time must be after the start time.',
        ]);

        DB::transaction(function () use ($user, $validated) {
            DriverAvailability::where('user_id', $user->id)->delete();
            foreach ($validated['weekly'] as $day) {
                DriverAvailability::create(['user_id' => $user->id, 'weekday' => $day['weekday'], 'start_time' => $day['start_time'], 'end_time' => $day['end_time']]);
            }
            foreach ($validated['blocked_dates'] as $date) {
                DriverAvailability::create(['user_id' => $user->id, 'date' => $date, 'is_blocked' => true]);
            }
        });

        return response()->json($this->availabilityPayload($user));
    }

    private function driver(Request $request): User
    {
        $user = $request->user();
        abort_unless($user->hasPermission('offer-driver-hire'), 403, 'You do not have permission to offer driver hire.');
        $user->load('driverProfile', 'hireSettings');
        abort_unless($user->driverProfile?->verification_status === DriverProfile::STATUS_VERIFIED, 403, 'Your driver account must be verified first.');

        return $user;
    }

    private function payload(User $user): array
    {
        $profile = $user->driverProfile;
        $g = RideSettings::hire();

        return [
            'settings' => $user->hireSettings ? array_intersect_key($user->hireSettings->toArray(),
                array_flip(['hourly_rate', 'min_hours', 'daily_rate', 'daily_hours', 'overtime_per_hour', 'out_of_town_fee', 'is_active'])) : null,
            'skills' => [
                'transmissions'      => $profile->transmissions ?? [],
                'languages'          => $profile->languages ?? [],
                'years_experience'   => $profile->years_experience,
                'licence_categories' => $profile->licence_categories ?? [],
            ],
            'limits' => array_intersect_key($g, array_flip(['hourly_min', 'hourly_max', 'daily_min', 'daily_max', 'overtime_max', 'out_of_town_max', 'commission_pct', 'service_fee'])),
        ];
    }

    private function availabilityPayload(User $user): array
    {
        $rows = DriverAvailability::where('user_id', $user->id)->get();

        return [
            'weekly' => $rows->whereNotNull('weekday')->sortBy('weekday')->map(fn ($r) => [
                'weekday' => $r->weekday, 'start_time' => substr((string) $r->start_time, 0, 5), 'end_time' => substr((string) $r->end_time, 0, 5),
            ])->values(),
            'blocked_dates' => $rows->where('is_blocked', true)->map(fn ($r) => $r->date?->toDateString())->filter()->sort()->values(),
            'upcoming' => DriverHire::where('driver_id', $user->id)->whereIn('status', DriverHire::BOOKED)->where('end_at', '>', now())
                ->orderBy('start_at')->limit(50)->get(['id', 'start_at', 'end_at'])
                ->map(fn ($h) => ['id' => $h->id, 'start_at' => $h->start_at->toIso8601String(), 'end_at' => $h->end_at->toIso8601String()]),
        ];
    }
}
