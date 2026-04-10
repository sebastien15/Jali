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

// Public — no auth needed
Route::post("/auth/login", [AuthController::class, "login"]);
Route::get("/buses", [BusController::class, "index"]);
Route::get("/car-rentals", [CarRentalController::class, "index"]);
Route::get("/private-seats", [PrivateSeatController::class, "index"]);

// Protected — requires Firebase ID token
Route::middleware("firebase.auth")->group(function () {
    // Bookings (user + admin shared)
    Route::get("/bookings", [BookingController::class, "index"]);
    Route::post("/bookings", [BookingController::class, "store"]);
    Route::get("/bookings/{id}", [BookingController::class, "show"]);

    // Booking 4-status lifecycle (admin)
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

    // Driver — requires create-private-seats permission
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

    // Analytics — admin/superadmin
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
    Route::prefix("admin/profile")->group(function () {
        Route::get("/", [AdminProfileController::class, "show"]);
        Route::patch("/", [AdminProfileController::class, "update"]);
        Route::post("/image", [
            AdminProfileController::class,
            "uploadProfileImage",
        ]);
        Route::post("/contract", [
            AdminProfileController::class,
            "uploadContract",
        ]);
    });

    // Admin panel
    Route::prefix("admin")->group(function () {
        // Location management (superadmin)
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

            // Location change requests (superadmin)
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

        // Admin location change (any admin can request)
        Route::post("/location-request", [
            LocationChangeRequestController::class,
            "store",
        ]);

        // Activity logs (superadmin)
        Route::middleware("permission:manage-admins")->group(function () {
            Route::get("/logs", [ActivityLogController::class, "index"]);
        });

        // Bookings admin view
        Route::middleware("permission:confirm-bookings")->group(function () {
            Route::get("/bookings", [AdminBookingController::class, "index"]);
            Route::patch("/bookings/{id}", [
                AdminBookingController::class,
                "update",
            ]);
        });

        // Station/location assignment (superadmin)
        Route::middleware("permission:manage-admins")->group(function () {
            Route::get("/stations", [AdminStationController::class, "index"]);
            Route::patch("/stations/{id}", [
                AdminStationController::class,
                "update",
            ]);
        });

        // User management (superadmin)
        Route::middleware("permission:manage-users")->group(function () {
            Route::get("/users", [AdminUserController::class, "index"]);
            Route::patch("/users/{id}", [AdminUserController::class, "update"]);
        });
    });
});
