import assert from "node:assert/strict";
const base = "http://127.0.0.1:8080/api/";
function client() {
  let csrf = "";
  const cookies = new Map();
  return async (path, method = "GET", body, status = 200) => {
    const r = await fetch(base + path, {
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
    assert.equal(r.status, status, JSON.stringify(d).slice(0, 300));
    if (d.csrf_token) csrf = d.csrf_token;
    return d;
  };
}
const admin = client(),
  finance = client();
for (const [api, email, password] of [
  [admin, "admin@space.test", process.env.CRM_ADMIN_PASSWORD],
  [finance, "fadi@dummy-space.test", process.env.CRM_FINANCE_PASSWORD],
]) {
  assert.ok(password);
  await api("session");
  await api("login", "POST", { email, password });
}
const create = async (r, p) =>
  (await admin("records/" + r, "POST", p, 201)).data;
const deals = (await admin("records/deals")).data;
const main = deals.find(
  (d) => d.name === "DUMMY AUDIT — Corrected Booth Cycle",
);
assert.ok(main);
let due = deals.find((d) => d.name === "DUMMY AUDIT — Collection Follow-up");
if (!due) {
  const pack = (await admin("records/sponsorship_packages")).data.find(
    (p) => p.name === "DUMMY AUDIT — Sponsor",
  );
  due = await create("deals", {
    name: "DUMMY AUDIT — Collection Follow-up",
    client_id: main.client_id,
    exhibition_id: main.exhibition_id,
    type: "sponsor",
    sponsorship_package_id: pack.id,
    salesperson_id: main.salesperson_id,
    amount: "2000",
    currency: "EGP",
    status: "closed_won",
    commission_percentage: "0",
  });
  const schedule = await create("payment_schedules", {
    name: "DUMMY AUDIT — Overdue Collection",
    deal_id: due.id,
    amount: "2000",
    due_date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10),
  });
  await create("payments", {
    name: "DUMMY-AUDIT-COLLECTION-DEPOSIT",
    payment_schedule_id: schedule.id,
    amount: "200",
    paid_date: new Date().toISOString().slice(0, 10),
    method: "cash",
  });
  const me = (await admin("session")).user;
  await admin(
    "workspace/collection-notes",
    "POST",
    {
      payment_schedule_id: schedule.id,
      assigned_user_id: me.id,
      note: "DUMMY AUDIT — Retained outstanding balance for collection review.",
      next_follow_up: new Date(Date.now() + 86400000)
        .toISOString()
        .slice(0, 10),
    },
    201,
  );
}
const requests = (await finance("workspace/requests")).data;
let pending = requests.find(
  (w) => w.reason === "DUMMY AUDIT UI — Reject duplicate correction request.",
);
if (!pending) {
  const receipt = (await admin("records/payments")).data.find(
    (p) => p.name === "DUMMY-AUDIT-RECEIPT-2",
  );
  pending = (
    await finance(
      "workspace/requests",
      "POST",
      {
        kind: "refund",
        deal_id: main.id,
        payment_id: receipt.id,
        amount: "100",
        reason: "DUMMY AUDIT UI — Reject duplicate correction request.",
      },
      201,
    )
  ).data;
}
console.log(
  JSON.stringify({
    collectionDeal: due.id,
    reviewRequest: pending.id,
    reviewStatus: pending.status,
  }),
);
for (const api of [admin, finance]) await api("logout", "POST");
