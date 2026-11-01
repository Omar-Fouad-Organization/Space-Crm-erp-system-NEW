import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.CRM_URL || 'http://127.0.0.1:8080/api/';
const password = process.env.CRM_ADMIN_PASSWORD;
if (!password) throw new Error('Set CRM_ADMIN_PASSWORD before running the local dummy-data cycle.');
const jar = new Map(); let csrf = ''; const checks = []; const records = {};
async function request(path, method = 'GET', body, expected = 200, csrfEnabled = true) {
  const form = body instanceof FormData;
  const res = await fetch(new URL(path, base), { method, headers: { Accept: 'application/json', ...(form ? {} : { 'Content-Type': 'application/json' }), Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '), ...(csrf && csrfEnabled ? { 'X-CSRF-TOKEN': csrf } : {}) }, ...(body === undefined ? {} : { body: form ? body : JSON.stringify(body) }) });
  for (const cookie of res.headers.getSetCookie()) { const pair = cookie.split(';')[0]; const n = pair.indexOf('='); jar.set(pair.slice(0, n), pair.slice(n + 1)); }
  const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
  assert.equal(res.status, expected, `${method} ${path}: ${text.slice(0, 800)}`);
  if (data?.csrf_token) csrf = data.csrf_token;
  checks.push({ method, path, status: res.status }); return data;
}
const create = async (resource, data) => { const result = (await request(`records/${resource}`, 'POST', data, 201)).data; records[resource] ??= []; records[resource].push(result.id); return result; };
const update = async (resource, row, data) => (await request(`records/${resource}/${row.id}`, 'PUT', { ...row, ...data })).data;
await request('metadata', 'GET', undefined, 401);
await request('session');
await request('login', 'POST', { email: 'admin@space.test', password }, 419, false);
const session = await request('login', 'POST', { email: 'admin@space.test', password });
const metadata = await request('metadata');
// Safe reruns do not overwrite the retained review cycle.
const prior = (await request('records/clients')).data.find(r => r.email === 'review@dummy-space.test');
if (prior) { console.log('Review cycle already exists; refusing to duplicate it.'); process.exit(0); }
const salesperson = await create('users', { name: 'DUMMY — Sara Sales', email: 'sara@dummy-space.test', role: 'sales', status: 'active', password: 'DummySales!2026#Only' });
const finance = await create('users', { name: 'DUMMY — Fadi Finance', email: 'fadi@dummy-space.test', role: 'finance', status: 'active', password: 'DummyFinance!2026#Only' });
const employee = await create('employees', { name: 'DUMMY — Sara employee profile', user_id: salesperson.id, manager_id: session.user.id, department: 'Sales', position: 'Account Executive', hire_date: '2026-11-01', salary: '12000.00', currency: 'EGP', status: 'active', notes: 'Dummy review employee only.' });
await update('employees', employee, { position: 'Senior Account Executive' });
const client = await create('clients', { name: 'DUMMY — Nile Technology LLC', contact_person: 'DUMMY — Mona Review', email: 'review@dummy-space.test', phone: '+20 100 000 0000', type: 'exhibitor', status: 'active', industry: 'Technology', notes: 'Retained end-to-end test client. All records are fictional.' });
await update('clients', client, { notes: 'Retained test client; create and edit verified.' });
const expo = await create('exhibitions', { name: 'DUMMY — Cairo Business Expo 2026', start_date: '2026-12-10', end_date: '2026-12-12', location: 'DUMMY Cairo Exhibition Hall', status: 'planning', manager_id: session.user.id, budget: '200000.00', currency: 'EGP', description: 'Dummy exhibition for relationship review.' });
await update('exhibitions', expo, { status: 'active' });
const booth = await create('booths', { name: 'DUMMY-A01', exhibition_id: expo.id, hall: 'A', zone: 'Technology', size_sqm: '25.00', price: '100000.00', currency: 'EGP', notes: '25 sqm review booth.' });
const spare = await create('booths', { name: 'DUMMY-A02', exhibition_id: expo.id, hall: 'A', zone: 'Technology', size_sqm: '16.00', price: '64000.00', currency: 'EGP' });
await update('booths', spare, { notes: 'Available spare booth for your manual tests.' });
const pack = await create('sponsorship_packages', { name: 'DUMMY — Gold Sponsorship', exhibition_id: expo.id, tier: 'gold', price: '50000.00', currency: 'EGP', description: 'Logo placement and speaking slot — dummy package.' });
const dealPayload = { name: 'DUMMY — Nile Technology Booth Deal', client_id: client.id, exhibition_id: expo.id, type: 'booth', booth_id: booth.id, salesperson_id: salesperson.id, amount: '100000.00', currency: 'EGP', status: 'lead_created', expected_close_date: '2026-11-15', commission_percentage: '5.00', notes: 'Complete review business cycle.' };
let deal = await create('deals', { ...dealPayload, installments: [{ name: 'DUMMY — 40% Deposit', amount: '40000.00', due_date: '2026-11-10' }, { name: 'DUMMY — 60% Balance', amount: '60000.00', due_date: '2026-12-01' }] });
await request('records/deals', 'POST', { ...dealPayload, name: 'INVALID duplicate booth' }, 422);
const proposal = await create('proposals', { name: 'DUMMY — Nile Booth Proposal', deal_id: deal.id, status: 'draft', content: '25 sqm booth at Cairo Business Expo. Total EGP 100,000; 40% deposit, 60% balance. Dummy data for review; no legal agreement.' });
await update('proposals', proposal, { status: 'sent' });
await update('proposals', proposal, { status: 'accepted' });
const meeting = await create('meetings', { name: 'DUMMY — Client kickoff', client_id: client.id, deal_id: deal.id, organizer_id: salesperson.id, meeting_date: '2026-11-05', meeting_time: '10:00', duration: 60, location: 'DUMMY meeting room', status: 'scheduled', agenda: 'Confirm booth scope and installments.', attendee_ids: [session.user.id, salesperson.id, finance.id] });
await update('meetings', meeting, { status: 'completed', meeting_time: '10:00', notes: 'Dummy kickoff completed. Scope and payment plan agreed.', attendee_ids: [session.user.id, salesperson.id, finance.id] });
const task = await create('tasks', { name: 'DUMMY — Prepare booth artwork', client_id: client.id, deal_id: deal.id, assigned_user_id: salesperson.id, due_date: '2026-11-20', priority: 'high', status: 'pending', description: 'Prepare and approve dummy artwork.' });
await update('tasks', task, { status: 'in_progress' }); await update('tasks', task, { status: 'completed' });
const document = await create('documents', { name: 'DUMMY — Nile Booth Agreement', client_id: client.id, deal_id: deal.id, type: 'contract', status: 'draft', notes: 'Dummy document; status is an internal record, not a legally verified electronic signature.' });
const form = new FormData(); form.append('file', new Blob(['DUMMY AGREEMENT\nClient: Nile Technology LLC\nDeal: EGP 100000\nReview data only.'], { type: 'text/plain' }), 'dummy-agreement.txt');
const attachment = (await request(`documents/${document.id}/attachments`, 'POST', form, 201)).data;
const downloaded = await request(`attachments/${attachment.id}`); assert.match(downloaded, /DUMMY AGREEMENT/);
await update('documents', document, { status: 'signed' });
const channel = await create('channels', { name: 'DUMMY — Nile Deal Team', deal_id: deal.id });
const message = await create('messages', { name: 'Dummy review: kickoff complete, proposal accepted, artwork approved.', channel_id: channel.id });
await update('messages', message, { name: 'Dummy review: kickoff complete; proposal and artwork approved. Ready for payment.' });
const ticket = await create('tickets', { name: 'DUMMY — Confirm power connection', client_id: client.id, deal_id: deal.id, assigned_user_id: salesperson.id, priority: 'medium', status: 'open', description: 'Confirm review booth power supply.' });
await update('tickets', ticket, { status: 'in_progress' }); await update('tickets', ticket, { status: 'resolved', resolution_notes: 'Dummy power connection confirmed.' }); await update('tickets', ticket, { status: 'closed', resolution_notes: 'Reviewed and closed.' });
for (const stage of ['talking', 'meeting', 'strategy_proposal', 'objection_handling', 'terms_finalized', 'closed_won']) deal = await update('deals', deal, { status: stage });
const schedules = (await request('records/payment_schedules')).data.filter(s => s.deal_id === deal.id);
assert.equal(schedules.length, 2);
for (const schedule of schedules) await create('payments', { name: `DUMMY-PAY-${schedule.id}`, payment_schedule_id: schedule.id, amount: schedule.amount, paid_date: '2026-11-01', method: 'bank_transfer', notes: 'Simulated receipt entry only; no funds transferred.' });
await request('records/payments', 'POST', { name: 'INVALID-OVERPAY', payment_schedule_id: schedules[0].id, amount: '0.01', paid_date: '2026-11-01', method: 'bank_transfer' }, 422);
const invoice = await create('invoices', { name: 'DUMMY-INV-2026-001', deal_id: deal.id, due_date: '2026-12-01', notes: 'Dummy invoice for review.' });
assert.equal(invoice.status, 'paid'); assert.equal(invoice.remaining_amount, '0.00');
let commission = (await request('records/commissions')).data.find(c => c.deal_id === deal.id);
assert.equal(commission.amount, '5000.00'); commission = await update('commissions', commission, { status: 'approved' }); await update('commissions', commission, { status: 'paid' });
const sponsorDeal = await create('deals', { name: 'DUMMY — Gold Sponsorship Pipeline', client_id: client.id, exhibition_id: expo.id, type: 'sponsor', sponsorship_package_id: pack.id, salesperson_id: salesperson.id, amount: '50000.00', currency: 'EGP', status: 'strategy_proposal', commission_percentage: '0.00' });
const temp = await create('tasks', { name: 'DUMMY — disposable CRUD probe', assigned_user_id: session.user.id, due_date: '2026-12-01', priority: 'low', status: 'pending' });
await request(`records/tasks/${temp.id}`, 'DELETE', undefined, 204); await request(`records/tasks/${temp.id}`, 'GET', undefined, 404);
records.tasks = records.tasks.filter(id => id !== temp.id);
await request(`records/clients/${client.id}`, 'DELETE', undefined, 422);
await request(`records/exhibitions/${expo.id}`, 'DELETE', undefined, 422);
await request('settings', 'PUT', metadata.settings);
const notes = (await request('notifications')).data; await request(`notifications/${notes[0].id}`, 'PATCH');
await request('audit'); await request('exhibitors');
for (const resource of Object.keys(metadata.resources)) {
  const list = (await request(`records/${resource}`)).data;
  assert.ok(list.length > 0, `${resource} has retained review data`);
  for (const item of list) await request(`records/${resource}/${item.id}`);
}
const final = (await request(`records/deals/${deal.id}`)).data; assert.equal(final.remaining_amount, '0.00');
const dashboard = await request('dashboard'); const egp = dashboard.totals.find(t => t.currency === 'EGP');
assert.equal(egp.received, '100000.00'); assert.equal(egp.won, '100000.00');
await request('logout', 'POST'); await request('metadata', 'GET', undefined, 401);
fs.writeFileSync(process.env.CRM_REPORT_PATH || '../demo-cycle-results.json', JSON.stringify({ checks: checks.length, requests: checks, records, primary: { client: client.id, exhibition: expo.id, booth: booth.id, deal: deal.id, invoice: invoice.id, document: document.id, sponsorDeal: sponsorDeal.id }, financial: egp, attachment: attachment.id, completedAt: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ checks: checks.length, records, financial: egp }));
