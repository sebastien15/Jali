<?php

namespace App\Http\Controllers;

use App\Modules\LegacyBookings\Application\BookingAnalytics;
use Illuminate\Http\Request;

/**
 * Transport adapter for LegacyBookings analytics (runbook M03-Bus). All
 * figures are scoped with Booking::manageableBy(): superadmins see the whole
 * platform, station admins only their station(s).
 */
class AnalyticsController extends Controller
{
    public function __construct(private readonly BookingAnalytics $analytics)
    {
    }

    /**
     * Revenue analytics — 50% platform / 50% admin split of service_fee
     */
    public function revenue(Request $request)
    {
        return response()->json(["data" => $this->analytics->revenue($request->user())]);
    }

    /**
     * Bookings analytics — counts by status, type, daily trend
     */
    public function bookings(Request $request)
    {
        return response()->json(["data" => $this->analytics->bookings($request->user())]);
    }

    /**
     * Earnings for the logged-in admin: 50% of the service fee on delivered
     * bookings they handled (superadmin: all delivered bookings).
     */
    public function earnings(Request $request)
    {
        return response()->json(["data" => $this->analytics->earnings($request->user())]);
    }

    /**
     * Performance per pickup location. Station admins only get the locations they manage.
     */
    public function stations(Request $request)
    {
        return response()->json(["data" => $this->analytics->stations($request->user())]);
    }
}
