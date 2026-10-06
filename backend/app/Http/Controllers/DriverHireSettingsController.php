<?php

namespace App\Http\Controllers;

use App\Models\DriverHire;
use App\Modules\DriverHire\Application\HireCalendar;
use App\Modules\DriverHire\Application\HireProviderSettings;
use App\Modules\DriverHire\Application\HireQuote;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Driver side of Hire a Driver setup: prices and skills (S6.1), weekly hours
 * and blocked dates (S6.2). Requires offer-driver-hire and a verified profile.
 * Transport adapter for DriverHire (runbook M03-Hire): validation + HTTP shape only.
 */
class DriverHireSettingsController extends Controller
{
    public function __construct(
        private readonly HireProviderSettings $settings,
        private readonly HireCalendar $calendar,
    ) {
    }

    /** GET /driver/hire-settings */
    public function show(Request $request)
    {
        return response()->json($this->settings->payload($this->settings->provider($request->user())));
    }

    /** PUT /driver/hire-settings — prices validated against the superadmin limits; skills on the driver profile */
    public function update(Request $request)
    {
        $user = $this->settings->provider($request->user());
        $validated = $request->validate(HireQuote::rateRules() + [
            'transmissions'    => 'required|array|min:1',
            'transmissions.*'  => ['string', 'distinct', Rule::in(DriverHire::TRANSMISSIONS)],
            'languages'        => 'required|array|min:1',
            'languages.*'      => ['string', 'distinct', Rule::in(HireProviderSettings::LANGUAGES)],
            'years_experience' => 'required|integer|min:0|max:60',
        ], HireQuote::rateMessages() + [
            'transmissions.required' => 'Choose at least one: automatic or manual.',
            'languages.required'     => 'Choose at least one language you speak.',
        ]);

        return response()->json($this->settings->payload($this->settings->update($user, $validated)));
    }

    /** GET /driver/availability */
    public function availability(Request $request)
    {
        return response()->json($this->calendar->payload($this->settings->provider($request->user())));
    }

    /** PUT /driver/availability — replaces the whole calendar */
    public function updateAvailability(Request $request)
    {
        $user = $this->settings->provider($request->user());
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

        $this->calendar->replace($user, $validated);

        return response()->json($this->calendar->payload($user));
    }
}
