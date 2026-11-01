<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
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
        if (!Auth::attempt([...$data, 'status' => 'active'])) {
            throw ValidationException::withMessages(['email' => 'Email or password is incorrect.']);
        }
        $request->session()->regenerate();
        return $this->show();
    }

    public function logout(Request $request)
    {
        Auth::logout(); $request->session()->invalidate(); $request->session()->regenerateToken();
        return $this->show();
    }
}
