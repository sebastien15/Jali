<?php

namespace App\Http\Controllers;

use App\Models\Booking;
use App\Models\Location;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * Revenue analytics — 50% platform / 50% admin split of service_fee
     */
    public function revenue(Request $request)
    {
        $user = $request->auth_user;

        $query = Booking::query()->where("status", "delivered");

        // Admin scoped to their location
        if ($user->isAdmin() && !$user->isSuperAdmin()) {
            if ($user->location_id) {
                $query->where("location_id", $user->location_id);
            } else {
                return response()->json(["data" => []]);
            }
        }

        $bookings = $query->get();

        $totalUserPaid = $bookings->sum(fn($b) => $b->price + $b->service_fee);
        $totalServiceProvider = $bookings->sum(fn($b) => $b->price);
        $totalServiceFee = $bookings->sum(fn($b) => $b->service_fee);
        $platformShare = $totalServiceFee * 0.5;
        $adminShare = $totalServiceFee * 0.5;

        return response()->json([
            "data" => [
                "total_user_paid" => $totalUserPaid,
                "total_service_provider" => $totalServiceProvider,
                "total_service_fee" => $totalServiceFee,
                "platform_share" => $platformShare,
                "admin_share" => $adminShare,
                "delivered_bookings" => $bookings->count(),
            ],
        ]);
    }

    /**
     * Bookings analytics — counts by status, type, daily trend
     */
    public function bookings(Request $request)
    {
        $user = $request->auth_user;

        $query = Booking::query();

        // Admin scoped to their location
        if ($user->isAdmin() && !$user->isSuperAdmin()) {
            if ($user->location_id) {
                $query->where("location_id", $user->location_id);
            } else {
                return response()->json(["data" => []]);
            }
        }

        $byStatus = $query
            ->clone()
            ->select("status", DB::raw("count(*) as count"))
            ->groupBy("status")
            ->get()
            ->pluck("count", "status");

        $byType = $query
            ->clone()
            ->select("type", DB::raw("count(*) as count"))
            ->groupBy("type")
            ->get()
            ->pluck("count", "type");

        $dailyTrend = $query
            ->clone()
            ->select(
                DB::raw("DATE(created_at) as date"),
                DB::raw("count(*) as count"),
            )
            ->groupBy("date")
            ->orderBy("date", "desc")
            ->limit(30)
            ->get();

        $totalBookings = $query->clone()->count();
        $totalRevenue = $query
            ->clone()
            ->get()
            ->sum(fn($b) => $b->price + $b->service_fee);

        return response()->json([
            "data" => [
                "total_bookings" => $totalBookings,
                "total_revenue" => $totalRevenue,
                "by_status" => [
                    "pending" => $byStatus["pending"] ?? 0,
                    "taken" => $byStatus["taken"] ?? 0,
                    "ticket_ready" => $byStatus["ticket_ready"] ?? 0,
                    "delivered" => $byStatus["delivered"] ?? 0,
                ],
                "by_type" => [
                    "bus" => $byType["bus"] ?? 0,
                    "rental" => $byType["rental"] ?? 0,
                    "private" => $byType["private"] ?? 0,
                ],
                "daily_trend" => $dailyTrend,
            ],
        ]);
    }

    /**
     * Earnings for the logged-in admin (50% of service_fee on delivered bookings)
     */
    public function earnings(Request $request)
    {
        $user = $request->auth_user;

        $query = Booking::query()->where("status", "delivered");

        if ($user->isAdmin() && !$user->isSuperAdmin()) {
            if ($user->location_id) {
                $query->where("location_id", $user->location_id);
            } else {
                return response()->json(["data" => []]);
            }
        }

        $allDelivered = $query->get();
        $totalServiceFee = $allDelivered->sum(fn($b) => $b->service_fee);
        $adminEarnings = $totalServiceFee * 0.5;

        // Today's earnings
        $todayQuery = clone $query;
        $todayBookings = $todayQuery->whereDate("updated_at", today())->get();
        $todayEarnings = $todayBookings->sum(fn($b) => $b->service_fee) * 0.5;

        // This week
        $weekQuery = clone $query;
        $weekBookings = $weekQuery
            ->whereBetween("updated_at", [
                now()->startOfWeek(),
                now()->endOfWeek(),
            ])
            ->get();
        $weekEarnings = $weekBookings->sum(fn($b) => $b->service_fee) * 0.5;

        // This month
        $monthQuery = clone $query;
        $monthBookings = $monthQuery
            ->whereMonth("updated_at", now()->month)
            ->get();
        $monthEarnings = $monthBookings->sum(fn($b) => $b->service_fee) * 0.5;

        return response()->json([
            "data" => [
                "total_earnings" => $adminEarnings,
                "today_earnings" => $todayEarnings,
                "week_earnings" => $weekEarnings,
                "month_earnings" => $monthEarnings,
                "delivered_count" => $allDelivered->count(),
            ],
        ]);
    }

    /**
     * Location analytics — performance per location
     */
    public function stations(Request $request)
    {
        $user = $request->auth_user;

        // Admin only sees their location
        if ($user->isAdmin() && !$user->isSuperAdmin()) {
            if (!$user->location_id) {
                return response()->json(["data" => null]);
            }
            $location = Location::withCount(["bookings"])->find(
                $user->location_id,
            );
            if (!$location) {
                return response()->json(["data" => null]);
            }

            $bookings = Booking::where(
                "location_id",
                $user->location_id,
            )->get();
            $totalRevenue = $bookings->sum(
                fn($b) => $b->price + $b->service_fee,
            );
            $adminShare =
                $bookings
                    ->where("status", "delivered")
                    ->sum(fn($b) => $b->service_fee) * 0.5;

            return response()->json([
                "data" => [
                    [
                        "id" => $location->id,
                        "name" => $location->name,
                        "city" => $location->city,
                        "type" => $location->type,
                        "total_bookings" => $location->bookings_count,
                        "total_revenue" => $totalRevenue,
                        "admin_share" => $adminShare,
                    ],
                ],
            ]);
        }

        // Superadmin sees all locations
        $locations = Location::withCount(["bookings"])->get();

        $stations = $locations->map(function ($location) {
            $bookings = Booking::where("location_id", $location->id)->get();
            $totalRevenue = $bookings->sum(
                fn($b) => $b->price + $b->service_fee,
            );
            $adminShare =
                $bookings
                    ->where("status", "delivered")
                    ->sum(fn($b) => $b->service_fee) * 0.5;

            $admin = $location->admins()->first();

            return [
                "id" => $location->id,
                "name" => $location->name,
                "city" => $location->city,
                "type" => $location->type,
                "admin_name" => $admin ? $admin->name : "Unassigned",
                "total_bookings" => $location->bookings_count,
                "total_revenue" => $totalRevenue,
                "admin_share" => $adminShare,
            ];
        });

        return response()->json(["data" => $stations]);
    }
}
