<?php

namespace App\Http\Controllers;

use App\Models\DriverPresence;
use App\Models\User;
use App\Modules\Providers\Application\DriverEligibility;
use Illuminate\Http\Request;

/**
 * Online/offline switch and location heartbeat (story S5.1).
 */
class DriverPresenceController extends Controller
{
    /** GET /driver/presence */
    public function show(Request $request)
    {
        return response()->json($this->payload($request->user()));
    }

    /** POST /driver/presence  { online, lat?, lng?, heading? } — call every 5–10 s while online */
    public function update(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'online'  => 'required|boolean',
            'lat'     => 'required_if:online,true|nullable|numeric|between:-90,90',
            'lng'     => 'required_if:online,true|nullable|numeric|between:-180,180',
            'heading' => 'sometimes|nullable|numeric|between:0,360',
        ]);

        $presence = DriverPresence::firstOrNew(['user_id' => $user->id]);

        if (!$validated['online']) {
            $presence->fill(['is_online' => false, 'online_since' => null])->save();

            return response()->json($this->payload($user, $presence));
        }

        $blockers = DriverEligibility::blockers($user);
        if ($blockers) {
            $presence->fill(['is_online' => false, 'online_since' => null])->save();

            return response()->json($this->payload($user, $presence, $blockers));
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

        return response()->json($this->payload($user, $presence, []));
    }

    private function payload(User $user, ?DriverPresence $presence = null, ?array $blockers = null): array
    {
        $presence ??= DriverPresence::find($user->id);
        $live = $presence && DriverPresence::live()->whereKey($user->id)->exists();

        return [
            'online'          => $live,
            'online_since'    => $live ? $presence->online_since?->toIso8601String() : null,
            'blocked_reasons' => $blockers ?? DriverEligibility::blockers($user),
        ];
    }
}
