<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . "/../routes/web.php",
        api: __DIR__ . "/../routes/api.php",
        commands: __DIR__ . "/../routes/console.php",
        health: "/up",
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->prepend(\Illuminate\Http\Middleware\HandleCors::class);
        $middleware->alias([
            "permission" => \App\Http\Middleware\CheckPermission::class,
        ]);
        // There is no web "login" route: never build a redirect for API guests
        // (doing so threw RouteNotFoundException → 500 instead of a JSON 401).
        $middleware->redirectGuestsTo(fn (Request $request) => $request->is("api/*") ? null : "/");
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Always return JSON for API routes — prevents redirect to non-existent 'login' route
        $exceptions->shouldRenderJsonWhen(function (Request $request, \Throwable $e) {
            return $request->is('api/*') || $request->expectsJson();
        });
    })
    ->create();
