<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\PlatformSetting;
use App\Services\PushService;
use App\Services\Rides\RateGuardrails;
use App\Services\Rides\RideSettings;
use Illuminate\Http\Request;

class RideSettingsController extends Controller
{
    /** GET /admin/settings/rides */
    public function show(Request $request)
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        return response()->json(RideSettings::get());
    }

    /** PUT /admin/settings/rides — full or partial update */
    public function update(Request $request, PushService $push)
    {
        $user = $request->user();
        abort_unless($user->isSuperAdmin(), 403);

        $validated = $request->validate(RideSettings::rules());
        // Only known vehicle classes are stored
        if (isset($validated['vehicle_classes'])) {
            $validated['vehicle_classes'] = array_intersect_key(
                $validated['vehicle_classes'],
                RideSettings::defaults()['vehicle_classes'],
            );
        }

        [$old, $new] = RideSettings::update($validated, $user);
        $flagged = RateGuardrails::flagOutOfBand($push);

        ActivityLog::create([
            'admin_id'    => $user->id,
            'action'      => 'ride_settings_updated',
            'entity_type' => 'platform_setting',
            'entity_id'   => PlatformSetting::where('key', RideSettings::KEY)->value('id'),
            'details'     => ['old' => $old, 'new' => $new, 'drivers_flagged' => $flagged],
        ]);

        return response()->json($new);
    }
}
