<?php

namespace App\Modules\LegacyBookings\Application;

use App\Models\AdminStation;
use App\Models\Booking;
use App\Models\Location;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Admin analytics over generic `bookings` (/analytics/revenue, bookings,
 * earnings, stations). Figures are scoped with Booking::manageableBy():
 * superadmins see the whole platform, station admins only their station(s).
 * Each method returns the response's `data` object.
 */
class BookingAnalytics
{
    /** Revenue — 50% platform / 50% admin split of service_fee */
    public function revenue(User $user): array
    {
        $totals = Booking::manageableBy($user)
            ->where("status", "delivered")
            ->selectRaw("count(*) as n, coalesce(sum(price), 0) as price, coalesce(sum(service_fee), 0) as fee")
            ->first();

        $fee = (int) $totals->fee;

        return [
            "total_user_paid" => (int) $totals->price + $fee,
            "total_service_provider" => (int) $totals->price,
            "total_service_fee" => $fee,
            "platform_share" => $fee * 0.5,
            "admin_share" => $fee * 0.5,
            "delivered_bookings" => (int) $totals->n,
        ];
    }

    /** Counts by status, type, daily trend */
    public function bookings(User $user): array
    {
        $query = Booking::manageableBy($user);

        $byStatus = (clone $query)->select("status", DB::raw("count(*) as count"))
            ->groupBy("status")->pluck("count", "status");
        $byType = (clone $query)->select("type", DB::raw("count(*) as count"))
            ->groupBy("type")->pluck("count", "type");

        $dailyTrend = (clone $query)
            ->select(DB::raw("DATE(created_at) as date"), DB::raw("count(*) as count"))
            ->groupBy("date")
            ->orderBy("date", "desc")
            ->limit(30)
            ->get();

        $totals = (clone $query)
            ->selectRaw("count(*) as n, coalesce(sum(price + service_fee), 0) as revenue")
            ->first();

        return [
            "total_bookings" => (int) $totals->n,
            "total_revenue" => (int) $totals->revenue,
            "by_status" => [
                "pending" => $byStatus["pending"] ?? 0,
                "taken" => $byStatus["taken"] ?? 0,
                "ticket_ready" => $byStatus["ticket_ready"] ?? 0,
                "delivered" => $byStatus["delivered"] ?? 0,
                "cancelled" => $byStatus["cancelled"] ?? 0,
            ],
            "by_type" => [
                "trip" => $byType["trip"] ?? 0,
                "bus" => $byType["bus"] ?? 0,
                "rental" => $byType["rental"] ?? 0,
                "private" => $byType["private"] ?? 0,
            ],
            "daily_trend" => $dailyTrend,
        ];
    }

    /**
     * Earnings for the admin: 50% of the service fee on delivered bookings
     * they handled (superadmin: all delivered bookings).
     */
    public function earnings(User $user): array
    {
        $query = Booking::where("status", "delivered")
            ->when(!$user->isSuperAdmin(), fn (Builder $q) => $q->where("confirmed_by", $user->id));

        $sumFee = fn (Builder $q) => (int) $q->sum("service_fee") * 0.5;

        return [
            "total_earnings" => $sumFee(clone $query),
            "today_earnings" => $sumFee((clone $query)->whereDate("updated_at", today())),
            "week_earnings" => $sumFee((clone $query)->whereBetween("updated_at", [now()->startOfWeek(), now()->endOfWeek()])),
            "month_earnings" => $sumFee((clone $query)->whereYear("updated_at", now()->year)->whereMonth("updated_at", now()->month)),
            "delivered_count" => (clone $query)->count(),
        ];
    }

    /**
     * Performance per pickup location (bookings are linked to a location by
     * departure city). Station admins only get the locations they manage.
     */
    public function stations(User $user): Collection
    {
        $stats = Booking::manageableBy($user)
            ->whereNotNull("location_id")
            ->select(
                "location_id",
                DB::raw("count(*) as total_bookings"),
                DB::raw("coalesce(sum(price + service_fee), 0) as total_revenue"),
                DB::raw("coalesce(sum(case when status = 'delivered' then service_fee else 0 end), 0) as delivered_fee"),
            )
            ->groupBy("location_id")
            ->get()
            ->keyBy("location_id");

        $locations = $user->isSuperAdmin()
            ? Location::all()
            : Location::whereIn("id", $stats->keys())->get();

        $adminsByCity = AdminStation::whereNotNull("user_id")->with("user:id,name")->get()
            ->groupBy("city")
            ->map(fn ($s) => $s->first()->user?->name);

        return $locations->map(fn ($location) => [
            "id" => $location->id,
            "name" => $location->name,
            "city" => $location->city,
            "type" => $location->type,
            "admin_name" => $adminsByCity[$location->city] ?? "Unassigned",
            "total_bookings" => (int) ($stats[$location->id]->total_bookings ?? 0),
            "total_revenue" => (int) ($stats[$location->id]->total_revenue ?? 0),
            "admin_share" => (int) ($stats[$location->id]->delivered_fee ?? 0) * 0.5,
        ])->values();
    }
}
