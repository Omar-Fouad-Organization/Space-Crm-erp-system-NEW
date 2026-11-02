import { useCallback, useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, exportCsv, money, label } from "@/crm/api";
import { all, metadata } from "@/services/laravelClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  WorkflowLinks,
  workflowNames,
  canUseWorkflow,
} from "@/components/workspace/WorkflowLinks";
import { AccountSecurity } from "@/components/workspace/AccountSecurity";
type Field = {
  key: string;
  title: string;
  type?: string;
  required?: boolean;
  options?: any[];
};
export function ActionForm({
  title,
  fields,
  onSubmit,
  button = "Save",
  initialValues = {},
}: {
  title: string;
  fields: Field[];
  onSubmit: (data: any) => Promise<void>;
  button?: string;
  initialValues?: Record<string, string>;
}) {
  const [values, setValues] = useState<Record<string, string>>(initialValues),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const native = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            setError("");
            setNotice("");
            try {
              const data = Object.fromEntries(
                Object.entries({ ...values, ...native }).filter(
                  ([, v]) => v !== "",
                ),
              );
              for (const f of fields)
                if (f.required && !data[f.key])
                  throw Error("Enter " + f.title + ".");
              setValues(data as Record<string, string>);
              await onSubmit(data);
              setNotice("Saved successfully.");
              setValues({});
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {fields.map((f) => (
            <div key={f.key}>
              <Label htmlFor={"wf-" + f.key}>
                {f.title}
                {f.required ? " *" : ""}
              </Label>
              {f.options ? (
                <Select
                  value={values[f.key] || ""}
                  onValueChange={(v) =>
                    setValues((x) => ({ ...x, [f.key]: v }))
                  }
                >
                  <SelectTrigger id={"wf-" + f.key}>
                    <SelectValue placeholder={"Choose " + f.title} />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map((o) => (
                      <SelectItem key={o.id ?? o} value={String(o.id ?? o)}>
                        {o.name ?? label(o)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.type === "textarea" ? (
                <Textarea
                  id={"wf-" + f.key}
                  name={f.key}
                  required={f.required}
                  value={values[f.key] || ""}
                  onChange={(e) =>
                    setValues((x) => ({ ...x, [f.key]: e.target.value }))
                  }
                />
              ) : (
                <Input
                  id={"wf-" + f.key}
                  name={f.key}
                  type={f.type || "text"}
                  step={f.type === "number" ? "0.01" : undefined}
                  required={f.required}
                  value={values[f.key] || ""}
                  onChange={(e) =>
                    setValues((x) => ({ ...x, [f.key]: e.target.value }))
                  }
                />
              )}
            </div>
          ))}
          {error && (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          <Button disabled={busy}>{busy ? "Saving…" : button}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
function DataTable({ rows, columns }: { rows: any[]; columns: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th className="text-left p-3 border-b" key={c}>
                {label(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i}>
              {columns.map((c) => (
                <td className="p-3 border-b align-top" key={c}>
                  {c === "notes" && Array.isArray(r[c]) ? (
                    r[c].map((note: any) => (
                      <div key={note.id} className="mb-3">
                        <p>{note.note}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(note.created_at).toLocaleString()}
                          {note.next_follow_up
                            ? " · Next follow-up " + note.next_follow_up
                            : ""}
                        </p>
                      </div>
                    ))
                  ) : typeof r[c] === "object" ? (
                    <pre className="whitespace-pre-wrap max-w-md">
                      {JSON.stringify(r[c], null, 2)}
                    </pre>
                  ) : c.endsWith("_at") && r[c] ? (
                    new Date(r[c]).toLocaleString()
                  ) : (
                    String(r[c] ?? "—")
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="p-4">No matching records.</p>}
    </div>
  );
}
const ref = (
  key: string,
  title: string,
  options: any[],
  required = true,
): Field => ({ key, title, options, required });
const text = (
  key: string,
  title: string,
  type = "text",
  required = true,
): Field => ({ key, title, type, required });
export default function WorkflowWorkspace() {
  const [params] = useSearchParams(),
    section = params.get("section") || "collections";
  const { user } = useAuth();
  const role = user?.role;
  const finance = ["super_admin", "management", "finance"].includes(role || ""),
    manager = ["super_admin", "management"].includes(role || "");
  const [records, setRecords] = useState<Record<string, any[]>>({}),
    [rows, setRows] = useState<any[]>([]),
    [extra, setExtra] = useState<any>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [kind, setKind] = useState("refund"),
    [csv, setCsv] = useState("name,contact_person,email\n"),
    [preview, setPreview] = useState<any>(null),
    [auditPage, setAuditPage] = useState(1),
    [auditFilter, setAuditFilter] = useState({
      resource: "",
      actor: "",
      record: "",
    }),
    [reviewNote, setReviewNote] = useState("");
  const allowed = Object.keys(workflowNames).filter((k) =>
    canUseWorkflow(k, role || ""),
  );
  const generation = useRef(0);
  const load = useCallback(async () => {
    const version = ++generation.current;
    setBusy(true);
    setError("");
    try {
      if (!allowed.includes(section))
        throw Error("You do not have access to this workspace.");
      const meta = await metadata();
      const needed =
        section === "security"
          ? []
          : section === "access"
            ? []
            : section === "audit"
              ? ["users"]
              : section === "floorplan"
                ? ["booths", "exhibitions", "deals"]
                : section === "imports"
                  ? []
                  : section === "profitability"
                    ? ["exhibitions"]
                    : section === "collections"
                      ? ["users", "payment_schedules"]
                      : section === "reminders"
                        ? [
                            "users",
                            "tasks",
                            "meetings",
                            "proposals",
                            "payment_schedules",
                          ]
                        : [
                            "deals",
                            "payments",
                            "commissions",
                            "payment_schedules",
                          ];
      const pairs = await Promise.all(
        needed
          .filter((k) => meta.resources[k])
          .map(async (k) => [k, await all(k)] as const),
      );
      if (version !== generation.current) return;
      setRecords(Object.fromEntries(pairs));
      const endpoint = (
        {
          collections: "collections",
          approvals: "requests",
          profitability: "profitability",
          reminders: "reminders",
          access: "access",
          floorplan: "floorplan",
          audit:
            "audit?page=" + auditPage + "&" + new URLSearchParams(auditFilter),
        } as Record<string, string>
      )[section];
      if (endpoint) {
        const result = await api<any>("workspace/" + endpoint);
        if (version !== generation.current) return;
        setRows(result.data || []);
        setExtra(result);
      } else {
        setRows([]);
        setExtra({});
      }
    } catch (err) {
      if (version === generation.current) setError((err as Error).message);
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }, [section, role, auditPage, auditFilter]);
  useEffect(() => {
    setRows([]);
    setRecords({});
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  const save = async (path: string, data: any, method = "POST") => {
    await api("workspace/" + path, method, data);
    await load();
    window.dispatchEvent(new Event("crm-record-saved"));
  };
  const list = (key: string) => records[key] || [];
  useEffect(() => {
    if (
      role === "sales" &&
      !["discount", "payment_terms", "commission_rate"].includes(kind)
    )
      setKind("discount");
  }, [role, kind]);
  const kinds = finance
    ? role === "finance"
      ? ["refund", "receipt_reversal", "credit_note", "commission_recovery"]
      : [
          "refund",
          "receipt_reversal",
          "credit_note",
          "commission_recovery",
          "discount",
          "payment_terms",
          "commission_rate",
        ]
    : ["discount", "payment_terms", "commission_rate"];
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {workflowNames[section] || "Workspace"}
          </h1>
          <p className="text-muted-foreground">
            Related records, review history, and operational tools.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          Refresh
        </Button>
      </div>
      <WorkflowLinks sections={allowed} />
      {busy && <p role="status">Loading workspace…</p>}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {!error && (
        <>
          {section === "collections" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Installment Aging</CardTitle>
                  <CardDescription>
                    Balances include approved credits allocated to each
                    installment and net receipt corrections. Deal Outstanding
                    shows the current collectible cap.
                  </CardDescription>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportCsv("collections", rows, [
                        "name",
                        "deal",
                        "client",
                        "currency",
                        "outstanding",
                        "deal_outstanding",
                        "due_date",
                        "aging",
                      ])
                    }
                  >
                    Export Collections
                  </Button>
                </CardHeader>
                <CardContent>
                  <DataTable
                    rows={rows}
                    columns={[
                      "name",
                      "deal",
                      "client",
                      "currency",
                      "outstanding",
                      "deal_outstanding",
                      "due_date",
                      "aging",
                      "notes",
                    ]}
                  />
                </CardContent>
              </Card>
              <ActionForm
                title="Record Collection Follow-up"
                fields={[
                  ref("payment_schedule_id", "Installment", rows),
                  ref("assigned_user_id", "Collector", list("users")),
                  text("note", "Follow-up Note", "textarea"),
                  text("next_follow_up", "Next Follow-up", "date", false),
                ]}
                onSubmit={(v) => save("collection-notes", v)}
              />
            </>
          )}
          {section === "approvals" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Review Requests</CardTitle>
                  <CardDescription>
                    Two different people are required: requester and reviewing
                    manager. Approved financial corrections are immutable
                    internal records; they do not transfer money.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataTable
                    rows={rows}
                    columns={[
                      "id",
                      "kind",
                      "deal_id",
                      "payment_id",
                      "commission_id",
                      "amount",
                      "status",
                      "reason",
                      "requested_by",
                      "reviewed_by",
                      "review_note",
                    ]}
                  />
                  {manager && (
                    <div className="space-y-3 mt-4">
                      <Label htmlFor="review-note">Review Reason</Label>
                      <Textarea
                        id="review-note"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                      />
                      {rows
                        .filter(
                          (r) =>
                            r.status === "pending" &&
                            String(r.requested_by) !== user?.id,
                        )
                        .map((r) => (
                          <div key={r.id} className="flex gap-2 items-center">
                            <span>Request #{r.id}</span>
                            {["approved", "rejected"].map((decision) => (
                              <Button
                                key={decision}
                                variant="outline"
                                disabled={busy || reviewNote.trim().length < 8}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await save("requests/" + r.id + "/review", {
                                      decision,
                                      review_note: reviewNote,
                                    });
                                    setReviewNote("");
                                  } catch (err) {
                                    setError((err as Error).message);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                              >
                                {label(decision)}
                              </Button>
                            ))}
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <Label>Request Type</Label>
                  <Select
                    value={kinds.includes(kind) ? kind : kinds[0]}
                    onValueChange={setKind}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {kinds.map((k) => (
                        <SelectItem key={k} value={k}>
                          {label(k)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <ActionForm
                key={kind + finance}
                title="New Approval Request"
                fields={[
                  ref("deal_id", "Related Deal", list("deals")),
                  ...(["refund", "receipt_reversal"].includes(kind)
                    ? [ref("payment_id", "Original Receipt", list("payments"))]
                    : []),
                  ...(["credit_note", "payment_terms"].includes(kind)
                    ? [
                        ref(
                          "payment_schedule_id",
                          "Related Installment",
                          list("payment_schedules"),
                        ),
                      ]
                    : []),
                  ...(kind === "commission_recovery"
                    ? [
                        ref(
                          "commission_id",
                          "Paid Commission",
                          list("commissions").filter(
                            (c) => c.status === "paid",
                          ),
                        ),
                      ]
                    : []),
                  ...([
                    "refund",
                    "receipt_reversal",
                    "credit_note",
                    "commission_recovery",
                  ].includes(kind)
                    ? [text("amount", "Amount", "number")]
                    : kind === "discount"
                      ? [
                          text(
                            "discount_percentage",
                            "Proposed Discount %",
                            "number",
                          ),
                        ]
                      : kind === "commission_rate"
                        ? [
                            text(
                              "commission_percentage",
                              "Proposed Commission %",
                              "number",
                            ),
                          ]
                        : [
                            text(
                              "due_date",
                              "Proposed Installment Due Date",
                              "date",
                            ),
                          ]),
                  text("reason", "Reason", "textarea"),
                ]}
                onSubmit={async (v) => {
                  const effective = kinds.includes(kind) ? kind : kinds[0];
                  const payload = Object.fromEntries(
                    ["discount_percentage", "commission_percentage", "due_date"]
                      .filter((k) => v[k])
                      .map((k) => [k, v[k]]),
                  );
                  await save("requests", { ...v, kind: effective, payload });
                }}
              />
            </>
          )}
          {section === "profitability" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Exhibition Contribution</CardTitle>
                  <CardDescription>{extra.basis}</CardDescription>
                  <Button
                    variant="outline"
                    onClick={() =>
                      exportCsv("exhibition-profitability", rows, [
                        "exhibition",
                        "currency",
                        "sales",
                        "collections",
                        "expenses",
                        "commissions",
                        "contribution",
                      ])
                    }
                  >
                    Export Profitability
                  </Button>
                </CardHeader>
                <CardContent>
                  <DataTable
                    rows={rows}
                    columns={[
                      "exhibition",
                      "currency",
                      "sales",
                      "collections",
                      "expenses",
                      "commissions",
                      "contribution",
                    ]}
                  />
                </CardContent>
              </Card>
              <ActionForm
                title="Record Exhibition Expense"
                fields={[
                  ref("exhibition_id", "Exhibition", list("exhibitions")),
                  text("name", "Expense Name"),
                  ref("category", "Category", [
                    "venue",
                    "marketing",
                    "operations",
                    "staff",
                    "other",
                  ]),
                  text("amount", "Amount", "number"),
                  ref("currency", "Currency", [
                    "EGP",
                    "USD",
                    "EUR",
                    "SAR",
                    "AED",
                  ]),
                  text("expense_date", "Expense Date", "date"),
                  text("reference", "Unique Reference"),
                ]}
                onSubmit={(v) => save("expenses", v)}
              />
            </>
          )}
          {section === "floorplan" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Hall Availability</CardTitle>
                  <CardDescription>
                    Booths grouped by exhibition and hall. Open a booth to
                    inspect its relations; scheduled expiration only releases
                    unpaid open reservations.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PhysicalFloorplan
                    booths={list("booths")}
                    layouts={rows}
                    exhibitions={list("exhibitions")}
                  />
                  {list("exhibitions").map((expo) => (
                    <div key={expo.id} className="space-y-4 mb-6">
                      <h2 className="text-xl font-semibold">{expo.name}</h2>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {list("booths")
                          .filter((b) => b.exhibition_id === expo.id)
                          .map((b) => (
                            <Link
                              key={b.id}
                              to={"/booths/" + b.id}
                              className="border rounded-lg p-4 space-y-2"
                            >
                              <strong>{b.name}</strong>
                              <p>
                                {b.hall || "Hall not assigned"} · {b.size_sqm}{" "}
                                m²
                              </p>
                              <Badge
                                variant={
                                  b.status === "Available"
                                    ? "outline"
                                    : "secondary"
                                }
                              >
                                {b.status}
                              </Badge>
                              <p>{money(b.price, b.currency)}</p>
                            </Link>
                          ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {["super_admin", "management", "operations"].includes(
                role || "",
              ) && (
                <>
                  <ActionForm
                    title="Position Booth on Floor Plan"
                    fields={[
                      ref("booth_id", "Booth", list("booths")),
                      text("x", "X Position (0–950)", "number"),
                      text("y", "Y Position (0–550)", "number"),
                      text("width", "Width (30–400)", "number"),
                      text("height", "Height (30–400)", "number"),
                    ]}
                    onSubmit={(v) => save("floorplan", v, "PUT")}
                  />
                  <ActionForm
                    title="Set Reservation Expiry"
                    fields={[
                      ref(
                        "deal_id",
                        "Open Booth Deal",
                        list("deals").filter(
                          (d) =>
                            d.type === "booth" &&
                            !["closed_won", "closed_lost", "canceled"].includes(
                              d.stage,
                            ),
                        ),
                      ),
                      text("expires_at", "Expires At", "datetime-local"),
                    ]}
                    onSubmit={(v) =>
                      save("reservations/" + v.deal_id, {
                        expires_at: new Date(v.expires_at).toISOString(),
                      })
                    }
                  />
                </>
              )}
            </>
          )}
          {section === "imports" && (
            <Card>
              <CardHeader>
                <CardTitle>Client CSV Import</CardTitle>
                <CardDescription>
                  Required headers: name, contact_person, email. Optional:
                  phone, industry, address, notes, type, status. Preview
                  validates every row and detects existing or batch duplicates.
                  Import is atomic, up to 500 rows.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  aria-label="CSV file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 200000) {
                        setError("CSV must be below 200 KB.");
                        return;
                      }
                      setCsv(await f.text());
                      setPreview(null);
                    }
                  }}
                />
                <Textarea
                  aria-label="Client CSV"
                  className="min-h-40"
                  value={csv}
                  onChange={(e) => {
                    setCsv(e.target.value);
                    setPreview(null);
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        setPreview(
                          await api("workspace/import/clients", "POST", {
                            csv,
                          }),
                        );
                      } catch (err) {
                        setError((err as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Preview Import
                  </Button>
                  <Button
                    disabled={!preview?.valid || busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const r = await api<any>(
                          "workspace/import/clients",
                          "POST",
                          { csv, commit: true },
                        );
                        setPreview({
                          rows: [],
                          valid: false,
                          message: `Imported ${r.imported} clients.`,
                        });
                      } catch (err) {
                        setError((err as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Import Validated Rows
                  </Button>
                </div>
                {preview && (
                  <>
                    <p role="status">
                      {preview.message ||
                        (preview.valid
                          ? "All rows valid. Ready to import."
                          : "Resolve preview errors before importing.")}
                    </p>
                    <DataTable
                      rows={preview.rows}
                      columns={["line", "data", "errors"]}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          )}
          {section === "audit" && (
            <Card>
              <CardHeader>
                <CardTitle>Audit History</CardTitle>
                <CardDescription>
                  Search recorded before/after values. Password hashes and MFA
                  secrets are excluded.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  {(["resource", "actor", "record"] as const).map((k) => (
                    <Input
                      key={k}
                      aria-label={"Audit " + k}
                      placeholder={label(k)}
                      value={auditFilter[k]}
                      onChange={(e) => {
                        setAuditPage(1);
                        setAuditFilter((v) => ({ ...v, [k]: e.target.value }));
                      }}
                    />
                  ))}
                </div>
                <DataTable
                  rows={rows}
                  columns={[
                    "id",
                    "actor",
                    "resource",
                    "record_id",
                    "action",
                    "created_at",
                    "before",
                    "after",
                  ]}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={auditPage <= 1}
                    onClick={() => setAuditPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span>
                    Page {auditPage} of {extra.last_page || 1}
                  </span>
                  <Button
                    variant="outline"
                    disabled={auditPage >= (extra.last_page || 1)}
                    onClick={() => setAuditPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {section === "reminders" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Delivery History</CardTitle>
                  <CardDescription>
                    In-app reminders run through the Laravel scheduler. Email
                    requires a real configured transport; failed deliveries
                    retry up to three times.
                  </CardDescription>
                  {role === "super_admin" && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void save("reminders/run", {}).catch((err) =>
                          setError(err.message),
                        )
                      }
                    >
                      Run Due Reminders
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <DataTable
                    rows={rows}
                    columns={[
                      "id",
                      "name",
                      "resource",
                      "record_id",
                      "user_id",
                      "send_at",
                      "channel",
                      "status",
                      "attempts",
                      "last_error",
                      "delivered_at",
                    ]}
                  />
                </CardContent>
              </Card>
              {rows
                .filter((r) => ["pending", "failed"].includes(r.status))
                .map((r) => (
                  <Button
                    key={r.id}
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void save("reminders/" + r.id + "/cancel", {}).catch(
                        (e) => setError(e.message),
                      )
                    }
                  >
                    Cancel Reminder #{r.id}
                  </Button>
                ))}
              <ReminderForm
                records={records}
                onSave={(v) => save("reminders", v)}
              />
            </>
          )}
          {section === "access" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Record Visibility</CardTitle>
                  <CardDescription>
                    All preserves current access. Own includes assigned/created
                    deals and linked records. Team includes those records for
                    members of the selected team. Module permissions still
                    apply. Changes revoke that account’s sessions.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataTable
                    rows={extra.users || []}
                    columns={["id", "name", "role", "record_scope", "team_id"]}
                  />
                </CardContent>
              </Card>
              <ActionForm
                title="Create Team"
                fields={[text("name", "Team Name")]}
                onSubmit={(v) => save("teams", v)}
              />
              <ActionForm
                title="Assign Visibility"
                fields={[
                  ref("user_id", "User", extra.users || []),
                  ref("record_scope", "Visibility", ["all", "own", "team"]),
                  ref("team_id", "Team", extra.teams || [], false),
                ]}
                onSubmit={(v) =>
                  save(
                    "access/" + v.user_id,
                    {
                      record_scope: v.record_scope,
                      team_id: v.team_id || null,
                    },
                    "PUT",
                  )
                }
              />
            </>
          )}
          {section === "security" && <AccountSecurity />}
        </>
      )}
    </div>
  );
}
function ReminderForm({
  records,
  onSave,
}: {
  records: Record<string, any[]>;
  onSave: (v: any) => Promise<void>;
}) {
  const keys = ["tasks", "meetings", "proposals", "payment_schedules"].filter(
    (k) => records[k],
  );
  const [query] = useSearchParams();
  const [resource, setResource] = useState(query.get("resource") || "tasks");
  return (
    <>
      <Label>Reminder Module</Label>
      <Select value={resource} onValueChange={setResource}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {keys.map((k) => (
            <SelectItem key={k} value={k}>
              {label(k)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ActionForm
        key={resource}
        title="Schedule Reminder"
        initialValues={
          query.get("resource") === resource && query.get("record")
            ? { record_id: query.get("record")! }
            : {}
        }
        fields={[
          ref("record_id", "Related Record", records[resource] || []),
          ref("user_id", "Recipient", records.users || []),
          text("name", "Reminder Message"),
          text("send_at", "Send At", "datetime-local"),
          ref("channel", "Delivery Channel", ["in_app", "email"]),
        ]}
        onSubmit={(v) =>
          onSave({ ...v, resource, send_at: new Date(v.send_at).toISOString() })
        }
      />
    </>
  );
}
export function ActivityTimeline({
  resource,
  id,
}: {
  resource: "clients" | "deals";
  id: string;
}) {
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api<any>(`workspace/timeline/${resource}/${id}`)
      .then((r) => setRows(r.data))
      .catch((e) => setError(e.message));
  }, [resource, id]);
  const paths: Record<string, string> = {
    deals: "deals",
    payment_schedules: "payments",
    payments: "payments",
    invoices: "finance",
    commissions: "commissions",
    tasks: "tasks",
    meetings: "meetings",
    proposals: "proposals",
    documents: "contracts",
    tickets: "tickets",
    channels: "chat",
    messages: "chat",
    workflow_requests: "workspace?section=approvals",
    collection_notes: "workspace?section=collections",
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Related Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p role="alert">{error}</p>}
        {rows.map((r) => (
          <div
            key={r.resource + r.id}
            className="py-3 border-b flex justify-between"
          >
            <div>
              <Link
                className="text-blue-600 hover:underline"
                to={
                  "/" +
                  (paths[r.resource] || r.resource) +
                  (r.resource === "deals" ? "/" + r.id : "")
                }
              >
                {r.name}
              </Link>
              <p className="text-muted-foreground text-sm">
                {label(r.resource)} #{r.id} · {label(r.status)}
              </p>
            </div>
            <time>{new Date(r.at).toLocaleString()}</time>
          </div>
        ))}
        {!rows.length && !error && <p>No linked activities yet.</p>}
      </CardContent>
    </Card>
  );
}

function PhysicalFloorplan({
  booths,
  layouts,
  exhibitions,
}: {
  booths: any[];
  layouts: any[];
  exhibitions: any[];
}) {
  const [selected, setSelected] = useState("");
  const expo = selected || exhibitions[0]?.id;
  const positioned = booths.filter(
    (b) =>
      b.exhibition_id === expo &&
      layouts.some((l) => String(l.booth_id) === b.id),
  );
  return (
    <div className="space-y-3 mb-6">
      <Label>Floor Plan Exhibition</Label>
      <Select value={expo} onValueChange={setSelected}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {exhibitions.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <svg
        viewBox="0 0 1000 600"
        role="img"
        aria-label="Saved booth floor plan"
        className="w-full border rounded bg-slate-50"
      >
        {positioned.map((b) => {
          const l = layouts.find((l) => String(l.booth_id) === b.id);
          return (
            <a key={b.id} href={"#/booths/" + b.id}>
              <rect
                x={l.x}
                y={l.y}
                width={l.width}
                height={l.height}
                fill={
                  b.status === "Available"
                    ? "#dcfce7"
                    : b.status === "Sold"
                      ? "#fee2e2"
                      : "#fef3c7"
                }
                stroke="#475569"
              />
              <text x={l.x + 5} y={l.y + 20} fontSize="14">
                {b.name}
              </text>
              <text x={l.x + 5} y={l.y + 38} fontSize="12">
                {b.status}
              </text>
            </a>
          );
        })}
        {!positioned.length && (
          <text x="24" y="40" fontSize="18">
            No saved positions. Use Position Booth below.
          </text>
        )}
      </svg>
      <p className="text-sm text-muted-foreground">
        Green: available · Amber: reserved · Red: sold. Only explicitly
        positioned booths appear on the physical plan; all booths remain in the
        hall list.
      </p>
    </div>
  );
}
