import assert from "node:assert/strict";
import fs from "node:fs";
const base = process.env.CRM_URL || "http://127.0.0.1:8080/api/";
let checks = 0;
function session() {
  const cookies = new Map();
  let csrf = "";
  return async (path, method = "GET", body, status = 200) => {
    const r = await fetch(new URL(path, base), {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Cookie: [...cookies].map(([k, v]) => k + "=" + v).join("; "),
        ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const c of r.headers.getSetCookie()) {
      const p = c.split(";")[0],
        i = p.indexOf("=");
      cookies.set(p.slice(0, i), p.slice(i + 1));
    }
    const data = await r.json();
    assert.equal(
      r.status,
      status,
      `${method} ${path}: ${JSON.stringify(data).slice(0, 400)}`,
    );
    if (data.csrf_token) csrf = data.csrf_token;
    checks++;
    return data;
  };
}
const admin = session(),
  sales = session(),
  finance = session();
for (const [api, email, password] of [
  [admin, "admin@space.test", process.env.CRM_ADMIN_PASSWORD],
  [sales, "sara@dummy-space.test", process.env.CRM_SALES_PASSWORD],
  [finance, "fadi@dummy-space.test", process.env.CRM_FINANCE_PASSWORD],
]) {
  assert.ok(password, "Provide dummy login passwords in the environment.");
  await api("session");
  await api("login", "POST", { email, password });
}
const original = (await admin("records/deals")).data;
assert.ok(
  !original.some((d) => d.name === "DUMMY AUDIT — Corrected Booth Cycle"),
  "This retained cycle already exists; use verification instead of duplicating it.",
);
const create = async (resource, data) =>
  (await admin("records/" + resource, "POST", data, 201)).data;
const date = (n) =>
    new Date(Date.now() + n * 86400000).toISOString().slice(0, 10),
  today = date(0);
const csv =
  "name,contact_person,email,type,status\nDUMMY AUDIT — Workflow Client,Dummy Review,audit-workflow@dummy-space.test,exhibitor,active\n";
assert.equal(
  (await admin("workspace/import/clients", "POST", { csv })).valid,
  true,
);
const imported = await admin("workspace/import/clients", "POST", {
  csv,
  commit: true,
});
const client = (await admin("records/clients/" + imported.ids[0])).data;
assert.equal(
  (await admin("workspace/import/clients", "POST", { csv })).valid,
  false,
);
checks += 2;
const expo = await create("exhibitions", {
  name: "DUMMY AUDIT — Workflow Expo",
  location: "DUMMY Hall C",
  start_date: date(10),
  end_date: date(12),
  status: "planning",
  currency: "EGP",
  budget: "5000",
});
const booth = await create("booths", {
  name: "DUMMY-AUDIT-01",
  exhibition_id: expo.id,
  hall: "C",
  size_sqm: "20",
  price: "10000",
  currency: "EGP",
});
const spare = await create("booths", {
  name: "DUMMY-AUDIT-02",
  exhibition_id: expo.id,
  hall: "C",
  size_sqm: "20",
  price: "10000",
  currency: "EGP",
});
const pack = await create("sponsorship_packages", {
  name: "DUMMY AUDIT — Sponsor",
  exhibition_id: expo.id,
  tier: "silver",
  price: "10000",
  currency: "EGP",
});
const users = (await admin("records/users")).data;
const sara = users.find((u) => u.email === "sara@dummy-space.test");
const adminId = users.find((u) => u.email === "admin@space.test").id;
const deal = await create("deals", {
  name: "DUMMY AUDIT — Corrected Booth Cycle",
  client_id: client.id,
  exhibition_id: expo.id,
  type: "booth",
  booth_id: booth.id,
  salesperson_id: sara.id,
  amount: "10000",
  base_price: "10000",
  discount_percentage: "0",
  tax_percentage: "0",
  currency: "EGP",
  status: "closed_won",
  commission_percentage: "5",
});
const schedule = await create("payment_schedules", {
  name: "DUMMY AUDIT — Installment",
  deal_id: deal.id,
  amount: "10000",
  due_date: date(-40),
});
const receipt = await create("payments", {
  name: "DUMMY-AUDIT-RECEIPT-1",
  payment_schedule_id: schedule.id,
  amount: "6000",
  paid_date: today,
  method: "cash",
});
const aging = (await admin("workspace/collections")).data.find(
  (s) => s.id === schedule.id,
);
assert.equal(aging.aging, "31–60 days");
checks++;
await admin(
  "workspace/collection-notes",
  "POST",
  {
    payment_schedule_id: schedule.id,
    assigned_user_id: adminId,
    note: "DUMMY AUDIT — Follow-up verified before settlement.",
    next_follow_up: date(1),
  },
  201,
);
async function approve(api, kind, extra) {
  const w = (
    await api(
      "workspace/requests",
      "POST",
      {
        kind,
        deal_id: deal.id,
        reason: "DUMMY AUDIT — Review source relationships and correction.",
        ...extra,
      },
      201,
    )
  ).data;
  await api(
    "workspace/requests/" + w.id + "/review",
    "POST",
    {
      decision: "approved",
      review_note: "Invalid self approval must be rejected.",
    },
    403,
  );
  await admin("workspace/requests/" + w.id + "/review", "POST", {
    decision: "approved",
    review_note: "DUMMY AUDIT — Approved against the original source record.",
  });
  return w;
}
await approve(finance, "refund", { payment_id: receipt.id, amount: "500" });
await approve(finance, "credit_note", {
  payment_schedule_id: schedule.id,
  amount: "1500",
});
assert.equal(
  (await admin("records/deals/" + deal.id)).data.remaining_amount,
  "3000.00",
);
checks++;
await create("payments", {
  name: "DUMMY-AUDIT-RECEIPT-2",
  payment_schedule_id: schedule.id,
  amount: "3000",
  paid_date: today,
  method: "cash",
});
const commission = (await admin("records/commissions")).data.find(
  (c) => c.deal_id === deal.id,
);
for (const status of ["approved", "paid"])
  await admin("records/commissions/" + commission.id, "PUT", {
    ...commission,
    status,
  });
await approve(finance, "commission_recovery", {
  commission_id: commission.id,
  amount: "100",
});
await approve(finance, "receipt_reversal", {
  payment_id: receipt.id,
  amount: "5500",
});
await create("payments", {
  name: "DUMMY-AUDIT-RECEIPT-REPLACEMENT",
  payment_schedule_id: schedule.id,
  amount: "5500",
  paid_date: today,
  method: "cash",
});
const final = (await admin("records/deals/" + deal.id)).data;
assert.equal(final.paid_amount, "8500.00");
assert.equal(final.credit_amount, "1500.00");
assert.equal(final.remaining_amount, "0.00");
checks += 3;
await admin(
  "workspace/expenses",
  "POST",
  {
    exhibition_id: expo.id,
    name: "DUMMY AUDIT — Venue expense",
    category: "venue",
    amount: "1000",
    currency: "EGP",
    expense_date: today,
    reference: "DUMMY-AUDIT-EXP-1",
  },
  201,
);
const open = await create("deals", {
  name: "DUMMY AUDIT — Approved Sponsor Terms",
  client_id: client.id,
  exhibition_id: expo.id,
  type: "sponsor",
  sponsorship_package_id: pack.id,
  salesperson_id: sara.id,
  amount: "10000",
  base_price: "10000",
  discount_percentage: "0",
  tax_percentage: "0",
  currency: "EGP",
  status: "strategy_proposal",
  commission_percentage: "5",
});
async function dealApproval(kind, payload, extra = {}) {
  const w = (
    await sales(
      "workspace/requests",
      "POST",
      {
        kind,
        deal_id: open.id,
        reason: "DUMMY AUDIT — Exceptional commercial terms requested.",
        payload,
        ...extra,
      },
      201,
    )
  ).data;
  await admin("workspace/requests/" + w.id + "/review", "POST", {
    decision: "approved",
    review_note: "DUMMY AUDIT — Exception reviewed and approved.",
  });
  return w;
}
await dealApproval("discount", { discount_percentage: "25" });
await dealApproval("commission_rate", { commission_percentage: "12" });
const terms = await create("payment_schedules", {
  name: "DUMMY AUDIT — Extended sponsor installment",
  deal_id: open.id,
  amount: "7500",
  due_date: date(15),
});
await dealApproval(
  "payment_terms",
  { due_date: date(100) },
  { payment_schedule_id: terms.id },
);
const reserved = await create("deals", {
  name: "DUMMY AUDIT — Expiring Reservation",
  client_id: client.id,
  exhibition_id: expo.id,
  type: "booth",
  booth_id: spare.id,
  salesperson_id: sara.id,
  amount: "10000",
  currency: "EGP",
  status: "talking",
  commission_percentage: "0",
});
await admin("workspace/reservations/" + reserved.id, "POST", {
  expires_at: new Date(Date.now() + 2000).toISOString(),
});
for (const [b, x] of [
  [booth, 50],
  [spare, 300],
])
  await admin("workspace/floorplan", "PUT", {
    booth_id: b.id,
    x,
    y: 50,
    width: 180,
    height: 120,
  });
const task = await create("tasks", {
  name: "DUMMY AUDIT — Review corrected cycle",
  client_id: client.id,
  deal_id: deal.id,
  assigned_user_id: adminId,
  status: "pending",
  priority: "high",
  due_date: date(1),
});
await admin(
  "workspace/reminders",
  "POST",
  {
    resource: "tasks",
    record_id: task.id,
    user_id: adminId,
    name: "DUMMY AUDIT — Review corrected cycle and relationships.",
    send_at: new Date(Date.now() + 2000).toISOString(),
    channel: "in_app",
  },
  201,
);
const timeline = (await admin("workspace/timeline/clients/" + client.id)).data;
for (const resource of [
  "deals",
  "payments",
  "payment_schedules",
  "commissions",
  "tasks",
]) {
  assert.ok(
    timeline.some((r) => r.resource === resource),
    resource,
  );
  checks++;
}
const diagnostics = await admin("diagnostics");
assert.equal(
  diagnostics.orphans.reduce((s, x) => s + x.count, 0),
  0,
);
checks++;
for (const id of [1, 3, 5]) {
  const d = (await admin("records/deals/" + id)).data;
  assert.equal(d.status, "closed_won");
  assert.equal(d.remaining_amount, "0.00");
  checks += 2;
}
const report = {
  at: new Date().toISOString(),
  checks,
  client: client.id,
  exhibition: expo.id,
  correctedDeal: deal.id,
  sponsorDeal: open.id,
  expiringDeal: reserved.id,
  booths: [booth.id, spare.id],
  netCollected: final.paid_amount,
  credited: final.credit_amount,
  remaining: final.remaining_amount,
  commission: commission.id,
  foreignKeys: diagnostics.orphans.length,
  brokenRelationships: 0,
};
if (process.env.CRM_REPORT_PATH)
  fs.writeFileSync(
    process.env.CRM_REPORT_PATH,
    JSON.stringify(report, null, 2),
  );
console.log(JSON.stringify(report, null, 2));
for (const api of [admin, sales, finance]) await api("logout", "POST");
