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
        $user=\App\Models\User::where('email',$data['email'])->where('status','active')->first();
        if (!$user || !\Illuminate\Support\Facades\Hash::check($data['password'],$user->password)) {
            throw ValidationException::withMessages(['email' => 'Email or password is incorrect.']);
        }
        if($user->mfa_confirmed_at){
            DB::transaction(function()use($user,$request){$u=DB::table('users')->where('id',$user->id)->lockForUpdate()->first();$counter=app(\App\Services\Totp::class)->verify(\Illuminate\Support\Facades\Crypt::decryptString($u->mfa_secret),(string)$request->input('code',''),$u->mfa_last_counter);if($counter===null)throw ValidationException::withMessages(['code'=>'Enter a valid, unused authenticator code.']);DB::table('users')->where('id',$u->id)->update(['mfa_last_counter'=>$counter]);});
        }
        Auth::login($user);$request->session()->regenerate();
        return $this->show();
    }

    public function logout(Request $request)
    {
        Auth::logout(); $request->session()->invalidate(); $request->session()->regenerateToken();
        return $this->show();
    }
}
