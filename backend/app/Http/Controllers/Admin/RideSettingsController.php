<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Pricing\Application\RideSettings;
use App\Modules\Pricing\Application\RideSettingsAdmin;
use Illuminate\Http\Request;

/** Transport adapter for Pricing's ride settings (runbook M03-Rides): validation + HTTP shape only. */
class RideSettingsController extends Controller
{
    public function __construct(private readonly RideSettingsAdmin $settings)
    {
    }

    /** GET /admin/settings/rides */
    public function show(Request $request)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        return response()->json($this->settings->current());
    }

    /** PUT /admin/settings/rides — full or partial update */
    public function update(Request $request)
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin(), 403);

        $validated = $request->validate(RideSettings::rules());

        return response()->json($this->settings->update($validated, $user));
    }
}
