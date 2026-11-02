import { useEffect, useState } from "react";
import { api } from "@/crm/api";
import { Button } from "@/components/ui/button";
export function BackupPanel() {
  const [state, setState] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = () => api<any>("workspace/backup-status").then(setState);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  return (
    <div className="space-y-3 mt-8 border-t pt-6">
      <h3 className="font-semibold">Backups & Scheduler</h3>
      <p>
        Latest private backup:{" "}
        {state?.latest
          ? `${state.latest.name} · ${new Date(state.latest.created_at).toLocaleString()}`
          : "None found"}
      </p>
      <p>
        Scheduler last seen:{" "}
        {state?.scheduler_last_seen
          ? new Date(state.scheduler_last_seen).toLocaleString()
          : "No heartbeat received"}
        . Daily backup: {state?.backup_time || "02:00"}{" "}
        {state?.schedule_timezone || "UTC"}.
      </p>
      <p className="text-sm text-muted-foreground">
        Backups stay on the server. Recovery verification runs separately
        against an isolated recovery database. Deployment needs a continuously
        running scheduler and a private off-site backup destination.
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          Refresh Backup Status
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              setState(await api("workspace/backup", "POST"));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating Backup…" : "Create Private Backup"}
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
