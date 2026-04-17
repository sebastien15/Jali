<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
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

// ── Access tracking — public (token optional, attached automatically if logged in) ──
Route::post("/track-access", [AppAccessController::class, "store"]);

// ── Auth Routes (no token required) ──
Route::post("/auth/login", [AuthController::class, "login"]);
Route::post("/auth/login/google", [
    AuthController::class,
    "loginWithGoogle",
]);
Route::post("/auth/otp/request", [AuthController::class, "requestOtp"]);
Route::post("/auth/otp/verify", [AuthController::class, "verifyOtp"]);

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

    // Driver routes
    Route::middleware("permission:create-private-seats")
        ->prefix("driver")
        ->group(function () {
            Route::get("/stats", [DriverController::class, "stats"]);
            Route::get("/trips", [DriverController::class, "trips"]);
            Route::patch("/profile", [
                DriverController::class,
                "updateProfile",
            ]);
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
            Route::get("/location-requests", [
                LocationChangeRequestController::class,
                "index",
            ]);
            Route::post("/location-requests/{id}/approve", [
                LocationChangeRequestController::class,
                "approve",
            ]);
            Route::post("/location-requests/{id}/reject", [
                LocationChangeRequestController::class,
                "reject",
            ]);
        });

        Route::middleware("permission:manage-locations")->post("/location-request", [
            LocationChangeRequestController::class,
            "store",
        ]);

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
