import assert from "node:assert/strict";
import fs from "node:fs";
const password = process.env.CRM_ADMIN_PASSWORD;
assert.ok(password, "Set CRM_ADMIN_PASSWORD.");
const cookies = new Map();
let csrf = "",
  checks = 0;
async function api(path, method = "GET", body, status = 200) {
  const r = await fetch("http://127.0.0.1:8080/api/" + path, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Cookie: [...cookies].map(([k, v]) => k + "=" + v).join("; "),
      ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  for (const c of r.headers.getSetCookie()) {
    const p = c.split(";")[0],
      i = p.indexOf("=");
    cookies.set(p.slice(0, i), p.slice(i + 1));
  }
  const d = await r.json();
  assert.equal(r.status, status, `${path}: ${JSON.stringify(d).slice(0, 300)}`);
  if (d.csrf_token) csrf = d.csrf_token;
  checks++;
  return d;
}
function equal(a, b) {
  assert.equal(a, b);
  checks++;
}
function ok(v, message) {
  assert.ok(v, message);
  checks++;
}
await api("session");
await api("login", "POST", { email: "admin@space.test", password });
const diagnostics = await api("diagnostics");
equal(diagnostics.orphans.length, 68);
equal(
  diagnostics.orphans.reduce((n, r) => n + r.count, 0),
  0,
);
for (const id of [1, 3, 5]) {
  const d = (await api("records/deals/" + id)).data;
  equal(d.status, "closed_won");
  equal(d.remaining_amount, "0.00");
}
const corrected = (await api("records/deals/6")).data;
equal(corrected.paid_amount, "8500.00");
equal(corrected.credit_amount, "1500.00");
equal(corrected.remaining_amount, "0.00");
const sponsor = (await api("records/deals/7")).data;
equal(sponsor.amount, "7500.00");
equal(sponsor.commission_percentage, "12.00");
equal((await api("records/deals/8")).data.status, "cancelled");
equal((await api("records/booths/5")).data.status, "available");
equal((await api("records/deals/9")).data.remaining_amount, "1800.00");
const requests = (await api("workspace/requests")).data;
equal(requests.filter((w) => w.status === "approved").length, 7);
equal(requests.find((w) => w.id === 8).status, "rejected");
ok(
  requests
    .filter((w) => w.status === "approved")
    .every((w) => w.requested_by !== w.reviewed_by),
);
const collection = (await api("workspace/collections")).data.find(
  (r) => r.deal_id === 9,
);
equal(collection.outstanding, "1800.00");
equal(collection.aging, "1–30 days");
ok(collection.notes.some((n) => n.note.includes("DUMMY AUDIT UI")));
const profitability = (await api("workspace/profitability")).data.find(
  (r) => r.exhibition_id === 3 && r.currency === "EGP",
);
equal(profitability.sales, "10500.00");
equal(profitability.collections, "8700.00");
equal(profitability.expenses, "1100.00");
equal(profitability.commissions, "400.00");
equal(profitability.contribution, "9000.00");
const movements = (await api("workspace/cash-movements")).data;
equal(
  movements
    .filter((m) => String(m.deal_id) === "6")
    .reduce((n, r) => n + Math.round(Number(r.amount) * 100), 0),
  850000,
);
equal(
  (await api("workspace/finance?days=30&currency=EGP")).metrics
    .payments_pending,
  "1800.00",
);
const timeline = (await api("workspace/timeline/clients/5")).data;
for (const resource of [
  "deals",
  "payment_schedules",
  "payments",
  "commissions",
  "tasks",
  "workflow_requests",
  "collection_notes",
])
  ok(
    timeline.some((r) => r.resource === resource),
    resource,
  );
const layouts = (await api("workspace/floorplan")).data;
equal(layouts.find((l) => l.booth_id === 5).x, 350);
equal((await api("records/deals?per_page=2")).last_page, 5);
await api("records/deals?per_page=1000", "GET", undefined, 422);
const audit = await api("workspace/audit?resource=workflow_requests&record=8");
ok(audit.data.some((r) => r.action === "request"));
ok(audit.data.some((r) => r.action === "rejected"));
const reminders = (await api("workspace/reminders")).data;
const delivered = reminders.find(
  (r) => r.name === "DUMMY AUDIT — Review corrected cycle and relationships.",
);
equal(delivered.status, "delivered");
equal(delivered.attempts, 1);
const uiReminder = reminders.find(
  (r) => r.name === "DUMMY AUDIT UI — Scheduled reminder delivery test.",
);
equal(uiReminder.status, "delivered");
equal(uiReminder.attempts, 1);
equal(
  (await api("notifications")).data.filter((n) => n.name === uiReminder.name)
    .length,
  1,
);
const access = await api("workspace/access");
ok(access.users.every((u) => u.record_scope === "all"));
ok(access.teams.some((t) => t.name === "DUMMY AUDIT UI — Sales Team"));
const security = await api("security");
equal(security.mfa_enabled, false);
ok(security.sessions.every((s) => s.id.length === 64));
const backup = await api("workspace/backup-status");
ok(backup.latest);
ok(
  Date.now() - Date.parse(backup.scheduler_last_seen) < 120000,
  "Scheduler heartbeat must be current.",
);
const search = await api(
  "workspace/search?q=audit-ui-import%40dummy-space.test",
);
equal(search.data.length, 1);
const result = {
  checkedAt: new Date().toISOString(),
  checks,
  foreignKeys: 68,
  brokenRelationships: 0,
  originalCyclesPreserved: [1, 3, 5],
  correctedCycle: {
    deal: 6,
    netCollected: "8500.00",
    credits: "1500.00",
    remaining: "0.00",
  },
  collectionReview: { deal: 9, outstanding: "1800.00" },
  approvedRequests: 7,
  rejectedRequests: 1,
  profitability,
  schedulerLastSeen: backup.scheduler_last_seen,
  reminderDeliveredOnce: true,
};
await api("logout", "POST");
if (process.env.CRM_REPORT_PATH)
  fs.writeFileSync(
    process.env.CRM_REPORT_PATH,
    JSON.stringify(result, null, 2),
  );
console.log(JSON.stringify(result, null, 2));
