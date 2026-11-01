<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CrmAuthenticated
{
    public function handle(Request $request, Closure $next)
    {
        abort_unless(Auth::check(), 401, 'Please sign in.');
        if (Auth::user()->status !== 'active') {
            Auth::logout();
            $request->session()->invalidate();
            abort(401, 'This account is inactive.');
        }
        return $next($request);
    }
}
