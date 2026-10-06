<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PushTokenController;
use App\Http\Controllers\DriverRateController;
use App\Http\Controllers\VehicleController;
use App\Http\Controllers\DriverOnboardingController;
use App\Http\Controllers\DriverPresenceController;
use App\Http\Controllers\RideController;
use App\Http\Controllers\PlaceController;
use App\Http\Controllers\DriverRideController;
use App\Http\Controllers\HireController;
use App\Http\Controllers\SafetyController;
use App\Http\Controllers\RideChatController;
use App\Http\Controllers\ReceiptController;
use App\Http\Controllers\FxController;
use App\Http\Controllers\DriverHireController;
use App\Http\Controllers\DriverHireSettingsController;
use App\Http\Controllers\Admin\RideSettingsController;
use App\Http\Controllers\Admin\AdminDriverController;
use App\Http\Controllers\Admin\AdminRideController;
use App\Http\Controllers\Admin\AdminSettlementController;
use App\Http\Controllers\Admin\RideAnalyticsController;
use App\Http\Controllers\DriverEarningsController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\BusController;
use App\Http\Controllers\CarRentalController;
use App\Http\Controllers\DriverController;
use App\Http\Controllers\PrivateSeatController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\Admin\AdminBookingController;
use App\Http\Controllers\Admin\AdminProfileController;
use App\Http\Controllers\Admin\AdminStationController;
use App\Http\Controllers\Admin\AdminUserController;
use App\Http\Controllers\Admin\ActivityLogController;
use App\Http\Controllers\Admin\LocationChangeRequestController;
use App\Http\Controllers\Admin\LocationController;
use App\Http\Controllers\TripSearchController;
use App\Http\Controllers\AgencyRatingController;
use App\Http\Controllers\Admin\AgencyController;
use App\Http\Controllers\Admin\TripController;
use App\Http\Controllers\AppAccessController;
use App\Http\Controllers\Admin\CashoutController;
use App\Http\Controllers\Admin\RolesController;
use App\Http\Controllers\Admin\PermissionsController;

// ── Access tracking — public (token optional, attached automatically if logged in) ──
Route::middleware("throttle:20,1")->post("/track-access", [AppAccessController::class, "store"]);

// ── Auth Routes (no token required) ──
// Rate limits (S21.7) are defined in AppServiceProvider::configureRateLimits()
Route::post("/auth/login", [AuthController::class, "login"])->middleware("throttle:auth");
Route::post("/auth/login/google", [
    AuthController::class,
    "loginWithGoogle",
])->middleware("throttle:auth");
Route::post("/auth/login/apple", [AuthController::class, "loginWithApple"])->middleware("throttle:auth");
Route::post("/auth/otp/request", [AuthController::class, "requestOtp"])->middleware("throttle:otp");
Route::post("/auth/otp/verify", [AuthController::class, "verifyOtp"])->middleware("throttle:otp-verify");

// Share my trip (S8.1) — PUBLIC by design: the 40-character token is the secret, and it stops working when the ride ends
Route::get("/share/{token}", [SafetyController::class, "publicShare"])->where("token", "[A-Za-z0-9]{40}")->middleware("throttle:60,1");

// ── Protected Routes (Sanctum) ──
Route::middleware("auth:sanctum")->group(function () {
    // Browsing data (requires login)
    Route::get("/buses", [BusController::class, "index"]);
    Route::get("/car-rentals", [CarRentalController::class, "index"]);
    Route::get("/private-seats", [PrivateSeatController::class, "index"]);
    Route::get("/stations", [AdminStationController::class, "index"]);
    Route::get("/trips", [TripSearchController::class, "index"]);

    // Current user
    Route::get("/me", [AuthController::class, "me"]);
    Route::post("/me/push-token", [PushTokenController::class, "store"]);
    Route::delete("/me/push-token", [PushTokenController::class, "destroy"]);
    Route::post("/auth/logout", [AuthController::class, "logout"]);
    Route::delete("/auth/me", [AuthController::class, "deleteAccount"]);

    // Bookings
    Route::get("/bookings", [BookingController::class, "index"]);
    Route::post("/bookings", [BookingController::class, "store"]);
    Route::get("/bookings/{id}", [BookingController::class, "show"]);

    // User rates an agency
    Route::post('/agencies/{agency}/rate', [AgencyRatingController::class, 'store']);

    // Booking lifecycle
    Route::middleware("permission:confirm-bookings")->group(function () {
        Route::post("/bookings/{id}/claim", [
            BookingController::class,
            "claim",
        ]);
        Route::patch("/bookings/{id}/ticket", [
            BookingController::class,
            "uploadTicket",
        ]);
        Route::post("/bookings/{id}/deliver", [
            BookingController::class,
            "deliver",
        ]);
    });

    // Rider: on-demand rides — RIDE_HAILING_PLAN.md §4–5
    Route::middleware("permission:request-rides")->prefix("rides")->group(function () {
        Route::get("/nearby", [RideController::class, "nearby"]);
        Route::post("/estimate", [RideController::class, "estimate"]);
        Route::get("/", [RideController::class, "index"]);
        Route::post("/", [RideController::class, "store"])->middleware("throttle:ride-requests");
        Route::get("/active", [RideController::class, "active"]);
        Route::get("/{id}", [RideController::class, "show"])->whereNumber("id");
        Route::post("/{id}/cancel", [RideController::class, "cancel"])->whereNumber("id");
        Route::post("/{id}/rate", [RideController::class, "rate"])->whereNumber("id");
        // Safety — stories S8.1, S8.2 (rider or driver of the ride)
        Route::post("/{id}/share", [SafetyController::class, "share"])->whereNumber("id");
        Route::post("/{id}/sos", [SafetyController::class, "sos"])->whereNumber("id");
        // Chat (S9.5) and receipts (S9.6)
        Route::get("/{id}/messages", [RideChatController::class, "index"])->whereNumber("id");
        Route::post("/{id}/messages", [RideChatController::class, "store"])->whereNumber("id")->middleware("throttle:30,1");
        Route::post("/{id}/receipt", [ReceiptController::class, "ride"])->whereNumber("id");
    });
    Route::middleware("permission:request-rides")->group(function () {
        Route::get("/me/emergency-contact", [SafetyController::class, "contact"]);
        Route::get("/fx/rates", [FxController::class, "rates"]);
        Route::post("/driver-hire/{id}/receipt", [ReceiptController::class, "hire"])->whereNumber("id");
        Route::put("/me/emergency-contact", [SafetyController::class, "saveContact"]);
    });
    // Driver side of a ride — stories S5.2, S4.1, S4.2, S4.4
    Route::middleware("permission:offer-rides")->group(function () {
        Route::get("/driver/ride-requests", [DriverRideController::class, "requests"]);
        Route::post("/rides/{id}/accept", [DriverRideController::class, "accept"])->whereNumber("id");
        Route::post("/rides/{id}/decline", [DriverRideController::class, "decline"])->whereNumber("id");
        Route::post("/rides/{id}/arrive", [DriverRideController::class, "arrive"])->whereNumber("id");
        Route::post("/rides/{id}/start", [DriverRideController::class, "start"])->whereNumber("id");
        Route::post("/rides/{id}/complete", [DriverRideController::class, "complete"])->whereNumber("id");
    });
    Route::middleware(["permission:request-rides", "throttle:60,1"])->prefix("places")->group(function () {
        Route::get("/search", [PlaceController::class, "search"]);
        Route::get("/reverse", [PlaceController::class, "reverse"]);
    });

    // Online/offline + location heartbeat — story S5.1
    Route::middleware("permission:offer-rides")->prefix("driver")->group(function () {
        Route::get("/presence", [DriverPresenceController::class, "show"]);
        Route::post("/presence", [DriverPresenceController::class, "update"]);
    });

    // Driver verification queue — story S1.4
    Route::middleware("permission:verify-drivers")->prefix("admin/drivers")->group(function () {
        Route::get("/", [AdminDriverController::class, "index"]);
        Route::get("/review", [AdminDriverController::class, "review"]);
        Route::post("/{userId}/warn", [AdminDriverController::class, "warn"])->whereNumber("userId");
        Route::get("/{userId}", [AdminDriverController::class, "show"])->whereNumber("userId");
        Route::post("/{userId}/verify", [AdminDriverController::class, "verify"])->whereNumber("userId");
        Route::post("/{userId}/reject", [AdminDriverController::class, "reject"])->whereNumber("userId");
        Route::post("/{userId}/suspend", [AdminDriverController::class, "suspend"])->whereNumber("userId");
    });

    // Hire a Driver: customer side — stories S6.3, S6.4
    Route::middleware("permission:request-rides")->prefix("driver-hire")->group(function () {
        Route::get("/available", [HireController::class, "available"]);
        Route::get("/", [HireController::class, "index"]);
        Route::post("/", [HireController::class, "store"])->middleware("throttle:ride-requests");
        Route::get("/{id}", [HireController::class, "show"])->whereNumber("id");
        Route::post("/{id}/cancel", [HireController::class, "cancel"])->whereNumber("id");
        Route::post("/{id}/rate", [HireController::class, "rate"])->whereNumber("id");
    });
    // Hire a Driver: driver side — stories S6.1, S6.2, S6.4
    Route::middleware("permission:offer-driver-hire")->group(function () {
        Route::get("/driver/hire-settings", [DriverHireSettingsController::class, "show"]);
        Route::put("/driver/hire-settings", [DriverHireSettingsController::class, "update"]);
        Route::get("/driver/availability", [DriverHireSettingsController::class, "availability"]);
        Route::put("/driver/availability", [DriverHireSettingsController::class, "updateAvailability"]);
        Route::get("/driver/hires", [DriverHireController::class, "index"]);
        Route::post("/driver-hire/{id}/accept", [DriverHireController::class, "accept"])->whereNumber("id");
        Route::post("/driver-hire/{id}/decline", [DriverHireController::class, "decline"])->whereNumber("id");
        Route::post("/driver-hire/{id}/check-in", [DriverHireController::class, "checkIn"])->whereNumber("id");
        Route::post("/driver-hire/{id}/check-out", [DriverHireController::class, "checkOut"])->whereNumber("id");
    });

    // Driver money — stories S5.4, S7.1, S7.2
    Route::middleware("permission:offer-rides")->group(function () {
        Route::get("/driver/earnings", [DriverEarningsController::class, "show"]);
        Route::post("/driver/settlements", [DriverEarningsController::class, "settle"]);
        Route::put("/driver/momo", [DriverEarningsController::class, "momo"]);
        Route::post("/driver/payouts", [DriverEarningsController::class, "payout"]);
    });
    Route::middleware("permission:manage-rides")->prefix("admin/settlements")->group(function () {
        Route::get("/", [AdminSettlementController::class, "index"]);
        Route::post("/{id}/confirm", [AdminSettlementController::class, "confirm"])->whereNumber("id");
        Route::post("/{id}/reject", [AdminSettlementController::class, "reject"])->whereNumber("id");
    });

    // Ride operations — stories S10.1, S10.2
    Route::middleware("permission:manage-rides")->prefix("admin/rides")->group(function () {
        Route::get("/live", [AdminRideController::class, "live"]);
        Route::get("/", [AdminRideController::class, "index"]);
        Route::get("/{id}", [AdminRideController::class, "show"])->whereNumber("id");
        Route::post("/{id}/adjust", [AdminRideController::class, "adjust"])->whereNumber("id");
    });

    // Ride pricing guardrails (superadmin) — RIDE_HAILING_PLAN.md §3.3
    Route::middleware("permission:manage-ride-pricing")->group(function () {
        Route::get("/admin/settings/rides", [RideSettingsController::class, "show"]);
        Route::put("/admin/settings/rides", [RideSettingsController::class, "update"]);
    });

    // Driver onboarding — any signed-in user can apply (stories S1.1–S1.3)
    Route::middleware("permission:apply-as-driver")->prefix("driver")->group(function () {
        Route::get("/vehicles", [VehicleController::class, "index"]);
        Route::post("/vehicles", [VehicleController::class, "store"]);
        Route::patch("/vehicles/{id}", [VehicleController::class, "update"])->whereNumber("id");
        Route::delete("/vehicles/{id}", [VehicleController::class, "destroy"])->whereNumber("id");
        Route::post("/vehicles/{id}/activate", [VehicleController::class, "activate"])->whereNumber("id");
        Route::post("/vehicles/{id}/photos", [VehicleController::class, "uploadPhoto"])->whereNumber("id");

        Route::get("/onboarding", [DriverOnboardingController::class, "show"]);
        Route::put("/onboarding/services", [DriverOnboardingController::class, "services"]);
        Route::put("/onboarding/licence", [DriverOnboardingController::class, "licence"]);
        Route::post("/onboarding/submit", [DriverOnboardingController::class, "submit"]);
        Route::post("/documents", [DriverOnboardingController::class, "uploadDocument"]);
        // Owner or verify-drivers only — checked in the controller (404 otherwise)
        Route::get("/documents/{id}/file", [DriverOnboardingController::class, "documentFile"])->whereNumber("id");

        Route::get("/profile", [DriverController::class, "profile"]);
        Route::patch("/profile", [DriverController::class, "updateProfile"]);

        // Applicants set prices before verification; going online still needs offer-rides (S5.1)
        Route::get("/rates", [DriverRateController::class, "show"]);
        Route::put("/rates", [DriverRateController::class, "update"]);
    });

    // Driver routes
    Route::middleware("permission:create-private-seats")
        ->prefix("driver")
        ->group(function () {
            Route::get("/stats", [DriverController::class, "stats"]);
            Route::get("/trips", [DriverController::class, "trips"]);
            Route::get("/listings", [
                PrivateSeatController::class,
                "driverListings",
            ]);
            Route::post("/listings", [PrivateSeatController::class, "store"]);
            Route::patch("/listings/{id}", [
                PrivateSeatController::class,
                "update",
            ]);
            Route::delete("/listings/{id}", [
                PrivateSeatController::class,
                "destroy",
            ]);
            Route::get("/cars", [CarRentalController::class, "driverCars"]);
            Route::post("/cars", [CarRentalController::class, "storeCar"]);
            Route::patch("/cars/{id}", [
                CarRentalController::class,
                "updateCar",
            ]);
            Route::delete("/cars/{id}", [
                CarRentalController::class,
                "destroyCar",
            ]);
        });

    // Analytics
    Route::middleware("permission:view-analytics")->group(function () {
        Route::get("/analytics/revenue", [
            AnalyticsController::class,
            "revenue",
        ]);
        Route::get("/analytics/bookings", [
            AnalyticsController::class,
            "bookings",
        ]);
        Route::get("/analytics/earnings", [
            AnalyticsController::class,
            "earnings",
        ]);
        Route::get("/analytics/stations", [
            AnalyticsController::class,
            "stations",
        ]);
        Route::get("/analytics/rides", [RideAnalyticsController::class, "index"]);
    });

    // Admin profile
    Route::middleware("permission:confirm-bookings")->prefix("admin/profile")->group(function () {
        Route::get("/", [AdminProfileController::class, "show"]);
        Route::patch("/", [AdminProfileController::class, "update"]);
        Route::post("/image", [AdminProfileController::class, "uploadProfileImage"]);
        Route::post("/contract", [AdminProfileController::class, "uploadContract"]);
        Route::get("/contract-template", [AdminProfileController::class, "contractTemplate"]);
    });

    // Admin panel
    Route::prefix("admin")->group(function () {
        Route::middleware("permission:manage-locations")->group(function () {
            Route::get("/locations", [LocationController::class, "index"]);
            Route::post("/locations", [LocationController::class, "store"]);
            Route::patch("/locations/{id}", [
                LocationController::class,
                "update",
            ]);
            Route::delete("/locations/{id}", [
                LocationController::class,
                "destroy",
            ]);
        });

        Route::middleware("permission:manage-locations")->post("/location-request", [
            LocationChangeRequestController::class,
            "store",
        ]);

        // Approving location changes is a superadmin decision (manage-admins),
        // otherwise a station admin could approve their own request.
        Route::middleware("permission:manage-admins")->group(function () {
            Route::get("/location-requests", [LocationChangeRequestController::class, "index"]);
            Route::post("/location-requests/{id}/approve", [LocationChangeRequestController::class, "approve"]);
            Route::post("/location-requests/{id}/reject", [LocationChangeRequestController::class, "reject"]);
        });

        Route::middleware("permission:manage-admins")->group(function () {
            Route::get("/logs", [ActivityLogController::class, "index"]);
            Route::get("/logs/groups", [ActivityLogController::class, "groups"]);
            Route::get("/access-stats", [AppAccessController::class, "stats"]);
            Route::get("/app-accesses", [AppAccessController::class, "index"]);
        });

        Route::middleware("permission:confirm-bookings")->group(function () {
            Route::get("/bookings", [AdminBookingController::class, "index"]);
            Route::patch("/bookings/{id}", [AdminBookingController::class, "update"]);
            Route::post("/bookings/{id}/ticket", [AdminBookingController::class, "uploadTicket"]);

            // Cashout
            Route::get("/cashout/preference", [CashoutController::class, "preference"]);
            Route::post("/cashout/preference", [CashoutController::class, "savePreference"]);
            Route::get("/cashout/requests", [CashoutController::class, "index"]);
            Route::post("/cashout/requests", [CashoutController::class, "store"]);
        });

        Route::middleware("permission:manage-admins")->group(function () {
            Route::get("/stations", [AdminStationController::class, "index"]);
            Route::post("/stations", [AdminStationController::class, "store"]);
            Route::patch("/stations/{id}", [AdminStationController::class, "update"]);
            Route::delete("/stations/{id}", [AdminStationController::class, "destroy"]);
        });

        Route::middleware("permission:manage-users")->group(function () {
            Route::get("/users", [AdminUserController::class, "index"]);
            Route::patch("/users/{id}", [AdminUserController::class, "update"]);
        });

        // Roles & permissions management (superadmin only via manage-roles permission)
        Route::middleware("permission:manage-roles")->group(function () {
            Route::get("/roles", [RolesController::class, "index"]);
            Route::post("/roles", [RolesController::class, "store"]);
            Route::patch("/roles/{id}", [RolesController::class, "update"]);
            Route::delete("/roles/{id}", [RolesController::class, "destroy"]);
            Route::get("/roles/{id}/permissions", [RolesController::class, "showPermissions"]);
            Route::put("/roles/{id}/permissions", [RolesController::class, "syncPermissions"]);
            Route::get("/permissions", [PermissionsController::class, "index"]);
        });

        // Admin — agencies & trips
        Route::middleware("permission:manage-agencies")->group(function () {
            Route::apiResource("agencies", AgencyController::class);
            Route::post("agencies/{agency}/routes", [AgencyController::class, "addRoute"]);
            Route::delete("agencies/{agency}/routes/{route}", [AgencyController::class, "removeRoute"]);
            Route::apiResource("trips", TripController::class);
            Route::post("trips/{id}/departures", [TripController::class, "addDeparture"]);
            Route::delete("trips/{routeId}/departures/{departureId}", [TripController::class, "removeDeparture"]);
        });
    });
});
