<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Share my trip (S8.1): public page for family/friends; the token is the secret
Route::get('/t/{token}', fn (string $token) => view('share', ['token' => $token]))->where('token', '[A-Za-z0-9]{40}');

// Receipts (S9.6): printable page, link signed for 30 days and sent by email / from the app
Route::get('/receipts/{type}/{id}', function (string $type, int $id) {
    $r = $type === 'ride'
        ? \App\Services\Receipts\Receipts::forRide(\App\Models\Ride::findOrFail($id))
        : \App\Services\Receipts\Receipts::forHire(\App\Models\DriverHire::findOrFail($id));

    return view('receipt', ['r' => $r, 'link' => request()->fullUrl(), 'email' => false]);
})->whereIn('type', ['ride', 'hire'])->whereNumber('id')->middleware('signed')->name('receipt');
