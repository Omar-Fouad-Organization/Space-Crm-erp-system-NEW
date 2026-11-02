import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/crm/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
export function AccountSecurity() {
  const [state, setState] = useState<any>(null),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [secret, setSecret] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const load = () => api<any>("security").then(setState);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  const action = async (path: string, body: any) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<any>("security/" + path, "POST", body);
      if (result.secret) setSecret(result.secret);
      else {
        setSecret("");
        setPassword("");
        setCode("");
        setNotice("Account security updated.");
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Security</CardTitle>
        <CardDescription>
          Authenticator MFA is optional. Keep access to your authenticator;
          password recovery does not bypass MFA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>MFA: {state?.mfa_enabled ? "Enabled" : "Not enabled"}</p>
        <Label htmlFor="security-password">Current Password</Label>
        <Input
          id="security-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {!state?.mfa_enabled && !secret && (
          <Button
            disabled={busy || !password}
            onClick={() => void action("enroll", { password })}
          >
            Set Up Authenticator
          </Button>
        )}
        {secret && (
          <div>
            <p>
              Enter this setup key manually in your authenticator, then confirm
              a new six-digit code:
            </p>
            <code className="break-all">{secret}</code>
          </div>
        )}
        {(secret || state?.mfa_enabled) && (
          <>
            <Label htmlFor="security-code">Authenticator Code</Label>
            <Input
              id="security-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button
              disabled={busy || code.length !== 6}
              onClick={() =>
                void action(
                  secret ? "confirm" : "disable",
                  secret ? { code } : { password, code },
                )
              }
            >
              {secret ? "Confirm Authenticator" : "Disable Authenticator"}
            </Button>
          </>
        )}
        <div>
          <Button
            variant="outline"
            disabled={busy || !password}
            onClick={() => void action("revoke", { password })}
          >
            Sign Out Other Sessions
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <h3 className="font-semibold">Active Sessions</h3>
        {state?.sessions.map((s: any) => (
          <p key={s.id}>
            {s.current ? "This session" : "Other session"} ·{" "}
            {new Date(s.last_activity * 1000).toLocaleString()} · {s.user_agent}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
export function PasswordRecovery() {
  const [params] = useSearchParams(),
    token = params.get("token");
  const [email, setEmail] = useState(params.get("email") || ""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="max-w-lg mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{token ? "Reset Password" : "Recover Account"}</CardTitle>
          <CardDescription>
            A configured email service is required to deliver recovery links.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("session");
                const r = await api<any>(
                  "password/" + (token ? "reset" : "forgot"),
                  "POST",
                  token
                    ? {
                        email,
                        token,
                        password,
                        password_confirmation: confirmation,
                      }
                    : { email },
                );
                setNotice(r.message);
                setPassword("");
                setConfirmation("");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Label htmlFor="recovery-email">Email</Label>
            <Input
              id="recovery-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {token && (
              <>
                <Label htmlFor="recovery-password">New Password</Label>
                <Input
                  id="recovery-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Label htmlFor="recovery-confirmation">Confirm Password</Label>
                <Input
                  id="recovery-confirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </>
            )}
            {error && <p role="alert">{error}</p>}
            {notice && <p role="status">{notice}</p>}
            <Button disabled={busy}>
              {busy
                ? "Submitting…"
                : token
                  ? "Reset Password"
                  : "Send Recovery Link"}
            </Button>
            <Link className="block text-blue-600" to="/login">
              Return to Sign In
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
