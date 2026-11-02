<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{Crypt, DB, Hash};

class PrivilegeConfirmation
{
    public function confirm(Request $request): void
    {
        $values = $request->validate(['confirm_password' => 'required|string|max:128', 'confirm_code' => 'nullable|string|size:6']);
        DB::transaction(function () use ($request, $values) {
            $user = User::where('id', $request->user()->id)->lockForUpdate()->firstOrFail();
            abort_unless($user->role === 'super_admin' && $user->status === 'active'
                && $user->auth_version === (int) $request->session()->get(SessionRevocation::STAMP.'.version'), 401, 'Please sign in again.');
            abort_unless(Hash::check($values['confirm_password'], $user->password), 422, 'Current password is incorrect.');
            if ($user->mfa_confirmed_at) {
                $counter = app(Totp::class)->verify(Crypt::decryptString($user->mfa_secret), $values['confirm_code'] ?? '', $user->mfa_last_counter);
                abort_if($counter === null, 422, 'Enter a valid, unused authenticator code.');
                $user->forceFill(['mfa_last_counter' => $counter])->save();
            }
        });
    }
}
