<?php

namespace App\Http\Controllers;

use App\Models\AppAccess;
use Illuminate\Http\Request;

class AppAccessController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'platform' => 'required|in:ios,android,web',
        ]);

        AppAccess::create([
            'platform'   => $request->platform,
            'user_id'    => $request->user()?->id,
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['ok' => true]);
    }

    public function index(Request $request)
    {
        $query = AppAccess::with('user')
            ->orderBy('accessed_at', 'desc');

        if ($request->filled('platform')) {
            $query->where('platform', $request->platform);
        }
        if ($request->filled('from_date')) {
            $query->whereDate('accessed_at', '>=', $request->from_date);
        }
        if ($request->filled('to_date')) {
            $query->whereDate('accessed_at', '<=', $request->to_date);
        }

        $perPage = min((int) $request->get('per_page', 50), 200);
        $rows = $query->paginate($perPage);

        return response()->json($rows->through(fn($r) => [
            'id'          => $r->id,
            'platform'    => $r->platform,
            'user_email'  => $r->user?->email,
            'user_name'   => $r->user?->name,
            'ip_address'  => $r->ip_address,
            'accessed_at' => $r->accessed_at,
        ]));
    }

    public function stats()
    {
        $totals = AppAccess::selectRaw('platform, COUNT(*) as count')
            ->groupBy('platform')
            ->pluck('count', 'platform');

        $last30 = AppAccess::selectRaw('platform, COUNT(*) as count')
            ->where('accessed_at', '>=', now()->subDays(30))
            ->groupBy('platform')
            ->pluck('count', 'platform');

        return response()->json([
            'all_time'     => $totals,
            'last_30_days' => $last30,
        ]);
    }
}
