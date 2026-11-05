<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

require_once __DIR__.'/windows-filesystem.php';

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/intake.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(\App\Http\Middleware\LimitParticipantGatewayRequest::class);
        $middleware->prepend(\App\Http\Middleware\LimitIntakeRequest::class);
        $middleware->trimStrings(except: [fn ($request) => $request->is('api/internal/intake/*','api/internal/participant-portal/*')]);
        $middleware->convertEmptyStringsToNull(except: [fn ($request) => $request->is('api/internal/intake/*','api/internal/participant-portal/*')]);
        $middleware->appendToGroup('web', \App\Http\Middleware\ValidateStaffSession::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn ($request) => $request->is('api/*') || $request->expectsJson());
    })->create();
