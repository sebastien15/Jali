<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Share my trip (S8.1): public page for family/friends; the token is the secret
Route::get('/t/{token}', fn (string $token) => view('share', ['token' => $token]))->where('token', '[A-Za-z0-9]{40}');
