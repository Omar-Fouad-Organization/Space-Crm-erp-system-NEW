<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SessionRevocation
{
    public const STAMP = 'crm_authentication';

    public function sessionHash(Request $request): string
    {
        return hash_hmac('sha256', $request->session()->getId(), config('app.key'));
    }

    public function revokeCurrent(Request $request): void
    {
        DB::table('revoked_staff_sessions')->where('expires_at', '<=', now())->delete();
        // Also rejects replayed cookie sessions and late writes from in-flight requests.
        DB::table('revoked_staff_sessions')->updateOrInsert(
            ['session_hash' => $this->sessionHash($request)],
            ['expires_at' => now()->addMinutes((int) config('session.lifetime') + 1)],
        );
    }

    public function bind(Request $request, $user): void
    {
        abort_unless(isset($user->auth_version), 503, 'Authentication migration is required.');
        $request->session()->put(self::STAMP, [
            'user_id' => (int) $user->id, 'version' => (int) $user->auth_version,
        ]);
    }

    /** Invalidate every older session, independent of its storage driver. */
    public function revoke(int $userId, ?Request $keepCurrent = null): int
    {
        return DB::transaction(function () use ($userId, $keepCurrent) {
            $user = DB::table('users')->where('id', $userId)->lockForUpdate()->first();
            abort_unless($user, 404);
            abort_unless(isset($user->auth_version), 503, 'Authentication migration is required.');
            if ($keepCurrent) {
                $stamp = $keepCurrent->session()->get(self::STAMP);
                abort_unless(
                    $keepCurrent->user()?->id === $userId && is_array($stamp)
                    && ($stamp['user_id'] ?? null) === $userId
                    && ($stamp['version'] ?? null) === (int) $user->auth_version,
                    401, 'Please sign in again.',
                );
            }
            $user->auth_version++;
            DB::table('users')->where('id', $userId)->update([
                'auth_version' => $user->auth_version, 'remember_token' => Str::random(60),
            ]);
            // Cleanup is optional for enforcement, but retains database-driver behavior.
            $sessions = DB::table('sessions')->where('user_id', $userId);
            if ($keepCurrent) {
                $sessions->where('id', '!=', $keepCurrent->session()->getId());
                $this->bind($keepCurrent, $user);
                $keepCurrent->session()->forget('mfa_pending');
            }
            return $sessions->delete();
        });
    }
}
