<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\BusController;
use App\Http\Controllers\CarRentalController;
use App\Http\Controllers\DriverController;
use App\Http\Controllers\PrivateSeatController;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\AnalyticsController;

// Public — no auth needed
Route::post('/auth/login', [AuthController::class, 'login']);

// Protected — requires Firebase ID token
Route::middleware('firebase.auth')->group(function () {

    // Public listings
    Route::get('/buses', [BusController::class, 'index']);
    Route::get('/car-rentals', [CarRentalController::class, 'index']);
    Route::get('/private-seats', [PrivateSeatController::class, 'index']);

    // Bookings
    Route::get('/bookings', [BookingController::class, 'index']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::get('/bookings/{id}', [BookingController::class, 'show']);

    // Driver — requires create-private-seats permission (assigned to driver role)
    Route::middleware('permission:create-private-seats')->prefix('driver')->group(function () {
        Route::get('/stats',           [DriverController::class, 'stats']);
        Route::get('/trips',           [DriverController::class, 'trips']);
        Route::patch('/profile',       [DriverController::class, 'updateProfile']);

        Route::get('/listings',        [PrivateSeatController::class, 'driverListings']);
        Route::post('/listings',       [PrivateSeatController::class, 'store']);
        Route::patch('/listings/{id}', [PrivateSeatController::class, 'update']);
        Route::delete('/listings/{id}',[PrivateSeatController::class, 'destroy']);

        Route::get('/cars',            [CarRentalController::class, 'driverCars']);
        Route::post('/cars',           [CarRentalController::class, 'storeCar']);
        Route::patch('/cars/{id}',     [CarRentalController::class, 'updateCar']);
        Route::delete('/cars/{id}',    [CarRentalController::class, 'destroyCar']);
    });

    // Admin — ticket management
    Route::middleware('permission:upload-tickets')->group(function () {
        Route::patch('/bookings/{id}/ticket',  [TicketController::class, 'upload']);
        Route::patch('/bookings/{id}/confirm', [BookingController::class, 'confirm']);
    });

    // Analytics — superadmin/admin only
    Route::middleware('permission:view-analytics')->group(function () {
        Route::get('/analytics/revenue',  [AnalyticsController::class, 'revenue']);
        Route::get('/analytics/bookings', [AnalyticsController::class, 'bookings']);
        Route::get('/analytics/stations', [AnalyticsController::class, 'stations']);
    });
});
