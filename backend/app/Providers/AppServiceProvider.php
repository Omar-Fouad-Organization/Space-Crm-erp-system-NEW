<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->scoped(\App\Services\PermissionPolicy::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \Illuminate\Auth\Notifications\ResetPassword::createUrlUsing(fn($user,$token)=>rtrim(config('app.url'),'/').'/#/reset-password?token='.urlencode($token).'&email='.urlencode($user->email));
        //
    }
}
