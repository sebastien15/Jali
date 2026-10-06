<?php

namespace App\Http\Controllers;

use App\Modules\Notifications\Application\PushStats;
use Illuminate\Http\Request;

/** S12.3: open tracking (any signed-in user, own notifications only) and admin rates */
class PushNotificationController extends Controller
{
    /** POST /me/notifications/{id}/opened */
    public function opened(Request $request, int $id)
    {
        abort_unless(PushStats::opened($request->user(), $id), 404);

        return response()->noContent();
    }

    /** GET /admin/notifications/stats?days=7 */
    public function stats(Request $request)
    {
        $days = (int) ($request->validate(['days' => 'sometimes|integer|min:1|max:90'])['days'] ?? 7);

        return response()->json(['days' => $days, 'types' => PushStats::byType($days)]);
    }
}
