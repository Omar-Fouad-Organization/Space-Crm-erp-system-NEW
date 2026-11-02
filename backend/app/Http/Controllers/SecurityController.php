<?php
namespace App\Http\Controllers;
use App\Services\Totp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Hash, Crypt, Password};
use Illuminate\Validation\ValidationException;
class SecurityController extends Controller
{
    private function password(Request $r): void
    {
        $r->validate(["password" => "required|string"]);
        if (!Hash::check($r->input("password"), $r->user()->password)) {
            throw ValidationException::withMessages([
                "password" => "Current password is incorrect.",
            ]);
        }
    }
    public function show(Request $r)
    {
        return [
            "mfa_enabled" => (bool) $r->user()->mfa_confirmed_at,
            "sessions" => DB::table("sessions")
                ->where("user_id", $r->user()->id)
                ->orderByDesc("last_activity")
                ->get(["id", "last_activity", "user_agent"])
                ->map(
                    fn($s) => [
                        "id" => hash_hmac("sha256", $s->id, config("app.key")),
                        "current" => $s->id === $r->session()->getId(),
                        "last_activity" => $s->last_activity,
                        "user_agent" => $s->user_agent,
                    ],
                ),
        ];
    }
    public function enroll(Request $r, Totp $totp)
    {
        $this->password($r);
        abort_if($r->user()->mfa_confirmed_at, 422, "MFA is already enabled.");
        $secret = $totp->secret();
        $r->session()->put("mfa_pending", Crypt::encryptString($secret));
        return [
            "secret" => $secret,
            "uri" =>
                "otpauth://totp/" .
                rawurlencode("SPACE CRM:" . $r->user()->email) .
                "?secret=" .
                $secret .
                "&issuer=SPACE%20CRM",
        ];
    }
    public function confirm(Request $r, Totp $totp)
    {
        $r->validate(["code" => "required|string|size:6"]);
        $pending = $r->session()->get("mfa_pending");
        abort_unless($pending, 422, "Start enrollment first.");
        $counter = $totp->verify(
            Crypt::decryptString($pending),
            $r->input("code"),
        );
        abort_if($counter === null, 422, "Invalid authentication code.");
        DB::table("users")
            ->where("id", $r->user()->id)
            ->update([
                "mfa_secret" => $pending,
                "mfa_confirmed_at" => now(),
                "mfa_last_counter" => $counter,
            ]);
        $r->session()->forget("mfa_pending");
        DB::table("sessions")
            ->where("user_id", $r->user()->id)
            ->where("id", "!=", $r->session()->getId())
            ->delete();
        return ["enabled" => true];
    }
    public function disable(Request $r, Totp $totp)
    {
        $this->password($r);
        $r->validate(["code" => "required|string|size:6"]);
        $u = $r->user();
        abort_unless($u->mfa_confirmed_at, 422);
        abort_if(
            $totp->verify(
                Crypt::decryptString($u->mfa_secret),
                $r->input("code"),
                $u->mfa_last_counter,
            ) === null,
            422,
            "Invalid or previously used code.",
        );
        DB::table("users")
            ->where("id", $u->id)
            ->update([
                "mfa_secret" => null,
                "mfa_confirmed_at" => null,
                "mfa_last_counter" => null,
            ]);
        return ["enabled" => false];
    }
    public function revoke(Request $r)
    {
        $this->password($r);
        $count = DB::table("sessions")
            ->where("user_id", $r->user()->id)
            ->where("id", "!=", $r->session()->getId())
            ->delete();
        return ["revoked" => $count];
    }
    public function forgot(Request $r)
    {
        $r->validate(["email" => "required|email"]);
        if (!in_array(config("mail.default"), ["log", "array"])) {
            try {
                Password::sendResetLink($r->only("email"));
            } catch (\Throwable $e) {
                report($e);
            }
        }
        return [
            "message" =>
                "If an eligible account exists and email delivery is configured, a reset link will be sent.",
        ];
    }
    public function reset(Request $r)
    {
        $v = $r->validate([
            "email" => "required|email",
            "token" => "required|string",
            "password" => "required|string|min:12|max:128|confirmed",
        ]);
        $status = Password::reset($v, function ($user, $password) {
            $user
                ->forceFill([
                    "password" => Hash::make($password),
                    "remember_token" => \Illuminate\Support\Str::random(60),
                ])
                ->save();
            DB::table("sessions")->where("user_id", $user->id)->delete();
        });
        abort_unless(
            $status === Password::PASSWORD_RESET,
            422,
            "This reset link is invalid or expired.",
        );
        return [
            "message" =>
                "Password reset. Sign in again; existing MFA remains required.",
        ];
    }
}
