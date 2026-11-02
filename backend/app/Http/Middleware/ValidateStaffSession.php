<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\SessionRevocation;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ValidateStaffSession
{
    public function handle(Request $request, Closure $next)
    {
        if (Auth::check()) {
            // Reload security state, including when an earlier guard lookup was cached.
            $user = User::find(Auth::id());
            $stamp = $request->session()->get(SessionRevocation::STAMP);
            if (!$user || $user->status !== 'active' || !isset($user->auth_version)
                || !is_array($stamp) || ($stamp['user_id'] ?? null) !== $user->id
                || ($stamp['version'] ?? null) !== (int) $user->auth_version
                || DB::table('revoked_staff_sessions')
                    ->where('session_hash', app(SessionRevocation::class)->sessionHash($request))
                    ->where('expires_at', '>', now())->exists()) {
                Auth::logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();
                abort(401, 'Please sign in again.');
            }
            Auth::setUser($user);
        }
        return $next($request);
    }
}
