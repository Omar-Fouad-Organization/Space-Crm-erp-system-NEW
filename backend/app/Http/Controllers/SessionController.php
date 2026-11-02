<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class SessionController extends Controller
{
    public function show()
    {
        return ['csrf_token' => csrf_token(), 'user' => Auth::user()];
    }

    public function login(Request $request)
    {
        $data = $request->validate(['email' => 'required|email', 'password' => 'required|string']);
        $user = DB::transaction(function () use ($data, $request) {
            $user = \App\Models\User::where('email', $data['email'])->lockForUpdate()->first();
            if (!$user || $user->status !== 'active' || !\Illuminate\Support\Facades\Hash::check($data['password'], $user->password)) {
                throw ValidationException::withMessages(['email' => 'Email or password is incorrect.']);
            }
            abort_unless(isset($user->auth_version), 503, 'Authentication migration is required.');
            if ($user->mfa_confirmed_at) {
                $counter = app(\App\Services\Totp::class)->verify(
                    \Illuminate\Support\Facades\Crypt::decryptString($user->mfa_secret),
                    (string) $request->input('code', ''), $user->mfa_last_counter,
                );
                if ($counter === null) throw ValidationException::withMessages(['code' => 'Enter a valid, unused authenticator code.']);
                DB::table('users')->where('id', $user->id)->update(['mfa_last_counter' => $counter]);
            }
            return $user;
        });
        Auth::login($user);$request->session()->regenerate();
        $request->session()->forget('mfa_pending');
        app(\App\Services\SessionRevocation::class)->bind($request, $user);
        return $this->show();
    }

    public function logout(Request $request)
    {
        app(\App\Services\SessionRevocation::class)->revokeCurrent($request);
        Auth::logout(); $request->session()->invalidate(); $request->session()->regenerateToken();
        return $this->show();
    }
}
