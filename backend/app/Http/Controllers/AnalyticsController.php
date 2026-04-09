<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * Revenue analytics - breakdown of all money flows
     */
    public function revenue(Request $request)
    {
        $user = $request->auth_user;

        $query = Booking::query()->where('status', 'completed');

        // Admin can only view their station's analytics
        if ($user->hasPermission('view-station-analytics') && !$user->isSuperAdmin()) {
            $station = $user->adminStation;
            if ($station) {
                // Filter bookings by routes from/to this station
                $query->whereHas('bookable', function ($q) use ($station) {
                    $q->where('from', $station->city)
                      ->orWhere('to', $station->city);
                });
            }
        }

        $bookings = $query->get();

        $totalUserPaid = $bookings->sum(fn($b) => $b->price + $b->service_fee);
        $totalServiceProviderGets = $bookings->sum(fn($b) => $b->price);
        $totalJaliRevenue = $bookings->sum(fn($b) => $b->service_fee);
        $totalPlatformShare = $totalJaliRevenue / 2;  // 50% to platform
        $totalAdminStationShare = $totalJaliRevenue / 2;  // 50% to admin station

        return response()->json([
            'data' => [
                'total_user_paid' => $totalUserPaid,
                'total_service_provider_gets' => $totalServiceProviderGets,
                'total_jali_revenue' => $totalJaliRevenue,
                'platform_share' => $totalPlatformShare,
                'admin_station_share' => $totalAdminStationShare,
                'completed_bookings' => $bookings->count(),
            ],
        ]);
    }

    /**
     * Bookings analytics - counts and trends
     */
    public function bookings(Request $request)
    {
        $user = $request->auth_user;

        $query = Booking::query();

        // Admin can only view their station's analytics
        if ($user->hasPermission('view-station-analytics') && !$user->isSuperAdmin()) {
            $station = $user->adminStation;
            if ($station) {
                $query->whereHas('bookable', function ($q) use ($station) {
                    $q->where('from', $station->city)
                      ->orWhere('to', $station->city);
                });
            }
        }

        $byStatus = $query->clone()->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->get()
            ->pluck('count', 'status');

        $byType = $query->clone()->select('type', DB::raw('count(*) as count'))
            ->groupBy('type')
            ->get()
            ->pluck('count', 'type');

        $totalBookings = $query->clone()->count();
        $totalRevenue = $query->clone()->get()->sum(fn($b) => $b->price + $b->service_fee);

        return response()->json([
            'data' => [
                'total_bookings' => $totalBookings,
                'total_revenue' => $totalRevenue,
                'by_status' => [
                    'pending' => $byStatus['pending'] ?? 0,
                    'confirmed' => $byStatus['confirmed'] ?? 0,
                    'completed' => $byStatus['completed'] ?? 0,
                ],
                'by_type' => [
                    'bus' => $byType['bus'] ?? 0,
                    'rental' => $byType['rental'] ?? 0,
                    'private' => $byType['private'] ?? 0,
                ],
            ],
        ]);
    }

    /**
     * Station analytics - performance per bus station
     */
    public function stations(Request $request)
    {
        $user = $request->auth_user;

        // If admin, only show their station
        if ($user->hasPermission('view-station-analytics') && !$user->isSuperAdmin()) {
            $station = $user->adminStation;
            if (!$station) {
                return response()->json(['data' => null]);
            }

            $bookings = Booking::whereHas('bookable', function ($q) use ($station) {
                $q->where('from', $station->city)
                  ->orWhere('to', $station->city);
            })->get();

            return response()->json([
                'data' => [[
                    'city' => $station->city,
                    'admin_name' => $user->name,
                    'total_bookings' => $bookings->count(),
                    'total_revenue' => $bookings->sum(fn($b) => $b->price + $b->service_fee),
                    'station_share' => $bookings->sum(fn($b) => $b->service_fee) / 2,
                ]],
            ]);
        }

        // Superadmin sees all stations
        $cities = DB::table('buses')
            ->select('from as city')
            ->union(DB::table('buses')->select('to as city'))
            ->get()
            ->pluck('city')
            ->unique();

        $stations = $cities->map(function ($city) {
            $bookings = Booking::whereHas('bookable', function ($q) use ($city) {
                $q->where('from', $city)->orWhere('to', $city);
            })->get();

            $admin = DB::table('admin_stations')
                ->join('users', 'admin_stations.user_id', '=', 'users.id')
                ->where('admin_stations.city', $city)
                ->first();

            return [
                'city' => $city,
                'admin_name' => $admin->name ?? 'Unassigned',
                'total_bookings' => $bookings->count(),
                'total_revenue' => $bookings->sum(fn($b) => $b->price + $b->service_fee),
                'station_share' => $bookings->sum(fn($b) => $b->service_fee) / 2,
            ];
        });

        return response()->json(['data' => $stations]);
    }
}
