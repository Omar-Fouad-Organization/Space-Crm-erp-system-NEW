import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api, label } from '@/crm/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type Page<T> = { data: T[]; current_page: number; last_page: number };
type Deal = {
  id: number; name: string; sponsor: string; exhibition: string; package: string | null;
  commercial_status: string; approved: number; fulfilled: number; outstanding: number; overdue: number;
  in_progress: number; cancelled: number; employees: string[]; fulfillment: string; last_update: string | null;
};
type Terms = {
  title: string; description: string; category: string; due_date: string; assigned_user_id: string;
  required: boolean; document_id: string;
};
type Item = Omit<Terms, 'category' | 'due_date' | 'assigned_user_id' | 'required' | 'document_id'> & {
  id: number; category: string | null; due_date: string | null; assigned_user_id: number;
  required: boolean | number; document_id?: number | null; contract_restricted: boolean; employee_name: string; status: string; version: number;
};
type Option = { id: number; name: string };
type Detail = { items: Page<Item>; employees: Option[]; documents: Option[] };
type History = { actor_id: number; version: number; action: string; status: string; created_at: string;
  details: { note: string | null; terms: Record<string, unknown> | null } };
const emptyTerms: Terms = { title: '', description: '', category: '', due_date: '', assigned_user_id: '', required: true, document_id: '' };
const emptyFilters = { exhibition: '', sponsor: '', deal: '', status: '', employee: '', due: '' };
const statuses = ['draft', 'pending', 'in_progress', 'submitted', 'changes_requested', 'fulfilled', 'cancelled'];
const actions: Record<string, string> = {
  create: 'Create draft', edit: 'Edit draft', approve: 'Approve commitment', amend: 'Approve amendment',
  start: 'Begin work', progress: 'Record progress', submit: 'Submit for verification',
  changes: 'Request changes', fulfill: 'Verify fulfillment', cancel: 'Cancel deliverable',
};
const termsActions = ['create', 'edit', 'amend'];
const noteActions = ['amend', 'progress', 'submit', 'changes', 'fulfill', 'cancel'];
const selectClass = 'h-10 w-full rounded-md border bg-background px-3 text-sm';

function Paging({ page, move }: { page: Page<unknown>; move: (n: number) => void }) {
  return <div className="flex items-center gap-2">
    <Button variant="outline" size="sm" disabled={page.current_page <= 1} onClick={() => move(page.current_page - 1)}>Previous</Button>
    <span className="text-sm">Page {page.current_page} of {page.last_page}</span>
    <Button variant="outline" size="sm" disabled={page.current_page >= page.last_page} onClick={() => move(page.current_page + 1)}>Next</Button>
  </div>;
}

export function SponsorDeliverables({ exhibitions }: { exhibitions: Option[] }) {
  const { can, user } = useAuth();
  const [filters, setFilters] = useState(emptyFilters);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [deals, setDeals] = useState<Page<Deal>>();
  const [deal, setDeal] = useState<Deal>();
  const [itemPage, setItemPage] = useState(1);
  const [detail, setDetail] = useState<Detail>();
  const [history, setHistory] = useState<Item>();
  const [historyPage, setHistoryPage] = useState(1);
  const [events, setEvents] = useState<Page<History>>();
  const [editor, setEditor] = useState<{ action: string; item?: Item; requestId: string }>();
  const [terms, setTerms] = useState(emptyTerms);
  const [note, setNote] = useState('');
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api<Page<Deal>>('sponsor-delivery?page=' + page + query)
      .then(result => { if (active) setDeals(result); })
      .catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [page, query, revision]);

  useEffect(() => {
    if (!deal) return;
    let active = true;
    api<Detail>('sponsor-delivery/' + deal.id + '?page=' + itemPage)
      .then(result => { if (active) setDetail(result); })
      .catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [deal, itemPage, revision]);

  useEffect(() => {
    if (!deal || !history) return;
    let active = true;
    api<Page<History>>('sponsor-delivery/' + deal.id + '/' + history.id + '/history?page=' + historyPage)
      .then(result => { if (active) setEvents(result); })
      .catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [deal, history, historyPage]);

  function open(action: string, item?: Item) {
    setTerms(item ? {
      title: item.title, description: item.description, category: item.category ?? '', due_date: item.due_date ?? '',
      assigned_user_id: String(item.assigned_user_id), required: Boolean(item.required), document_id: String(item.document_id ?? ''),
    } : emptyTerms);
    setNote('');
    setActionError('');
    setEditor({ action, item, requestId: crypto.randomUUID() });
  }

  function update<K extends keyof Terms>(key: K, value: Terms[K]) {
    setTerms(current => ({ ...current, [key]: value }));
    setEditor(current => current && { ...current, requestId: crypto.randomUUID() });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !editor || !deal) return;
    setBusy(true);
    setActionError('');
    try {
      await api('sponsor-delivery/' + deal.id, 'POST', {
        action: editor.action, id: editor.item?.id, version: editor.item?.version ?? 0, request_id: editor.requestId, note: note || null,
        ...(termsActions.includes(editor.action) ? { ...terms, category: terms.category || null, due_date: terms.due_date || null,
          assigned_user_id: Number(terms.assigned_user_id), document_id: terms.document_id ? Number(terms.document_id) : null } : {}),
      });
      setEditor(undefined);
      setRevision(current => current + 1);
    } catch (e) {
      setActionError((e as Error).message);
      setRevision(current => current + 1);
    } finally {
      setBusy(false);
    }
  }

  function available(item: Item) {
    const result: string[] = [];
    if (item.status === 'draft') {
      if (can('sponsor_delivery.draft') && (!item.contract_restricted || can('documents.view'))) result.push('edit');
      if (can('sponsor_delivery.approve') && !item.contract_restricted) result.push('approve');
    }
    if (can('sponsor_delivery.approve')) {
      if (!['draft', 'cancelled'].includes(item.status) && (!item.contract_restricted || can('documents.view'))) result.push('amend');
      if (!['fulfilled', 'cancelled'].includes(item.status)) result.push('cancel');
    }
    if (can('sponsor_delivery.progress') && String(item.assigned_user_id) === user?.id) {
      if (item.status === 'pending') result.push('start');
      if (['in_progress', 'changes_requested'].includes(item.status)) result.push('progress', 'submit');
    }
    if (item.status === 'submitted' && can('sponsor_delivery.verify')) result.push('changes', 'fulfill');
    return result;
  }

  function apply(event: FormEvent) {
    event.preventDefault();
    setError('');
    setDeal(undefined);
    setDetail(undefined);
    setPage(1);
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    setQuery(params.size ? '&' + params.toString() : '');
  }

  return <Card>
    <CardHeader><CardTitle>Sponsorship deliverables</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <form onSubmit={apply} className="grid gap-2 md:grid-cols-4">
        <label>Exhibition<select className={selectClass} value={filters.exhibition} onChange={e => setFilters({ ...filters, exhibition: e.target.value })}>
          <option value="">All exhibitions</option>{exhibitions.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select></label>
        <label>Sponsor<Input value={filters.sponsor} onChange={e => setFilters({ ...filters, sponsor: e.target.value })} maxLength={100} /></label>
        <label>Deal reference<Input type="number" min="1" value={filters.deal} onChange={e => setFilters({ ...filters, deal: e.target.value })} /></label>
        <label>Status<select className={selectClass} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All statuses</option>{statuses.map(status => <option key={status} value={status}>{label(status)}</option>)}
        </select></label>
        <label>Employee ID<Input type="number" min="1" value={filters.employee} onChange={e => setFilters({ ...filters, employee: e.target.value })} /></label>
        <label>Due on or before<Input type="date" value={filters.due} onChange={e => setFilters({ ...filters, due: e.target.value })} /></label>
        <Button type="submit" variant="outline" className="self-end">Apply filters</Button>
      </form>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {!deals && !error && <p>Loading sponsorship deals…</p>}
      {deals?.data.length === 0 && <p>No confirmed sponsorship deals match.</p>}
      {deals && deals.data.length > 0 && <>
        <Table><TableHeader><TableRow>{['Sponsor and deal', 'Exhibition and package', 'Commitments', 'Responsible employees', 'Fulfillment', ''].map((heading, index) =>
          <TableHead key={index}>{heading}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{deals.data.map(row => <TableRow key={row.id}>
            <TableCell>{row.sponsor}<div className="text-muted-foreground">#{row.id} · {row.name} · {label(row.commercial_status)}</div></TableCell>
            <TableCell>{row.exhibition}<div className="text-muted-foreground">{row.package ?? 'No package'}</div></TableCell>
            <TableCell>{row.approved} approved · {row.fulfilled} fulfilled<br />{row.outstanding} outstanding · {row.overdue} overdue
              <br />{row.in_progress} in progress · {row.cancelled} cancelled</TableCell>
            <TableCell>{row.employees.join(', ') || '—'}</TableCell>
            <TableCell>{row.fulfillment}{row.last_update && <div className="text-muted-foreground">{new Date(row.last_update).toLocaleString()}</div>}</TableCell>
            <TableCell><Button variant="outline" size="sm" onClick={() => {
              if (deal?.id === row.id) return; setDeal(row); setDetail(undefined); setItemPage(1); setError('');
            }}>View deliverables</Button></TableCell>
          </TableRow>)}</TableBody></Table>
        <Paging page={deals} move={setPage} />
      </>}
      {deal && <section className="space-y-3 border-t pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{deal.sponsor} · Deal #{deal.id}</h3>
          {detail && can('sponsor_delivery.draft') && <Button size="sm" onClick={() => open('create')}>Create draft</Button>}
        </div>
        {!detail && !error && <p>Loading deliverables…</p>}
        {detail?.items.data.length === 0 && <p>Deliverables not configured.</p>}
        {detail && detail.items.data.length > 0 && <>
          <Table><TableHeader><TableRow>{['Deliverable', 'Employee', 'Due', 'Status', 'Actions'].map(heading =>
            <TableHead key={heading}>{heading}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{detail.items.data.map(item => <TableRow key={item.id}>
              <TableCell><strong>{item.title}</strong><div className="whitespace-pre-wrap">{item.description}</div>
                <div className="text-muted-foreground">{item.required ? 'Required' : 'Optional'}{item.category && ' · ' + item.category}</div>
                {item.document_id && <div className="text-muted-foreground">Contract #{item.document_id}</div>}
              </TableCell>
              <TableCell>{item.employee_name + ' (#' + item.assigned_user_id + ')'}</TableCell>
              <TableCell>{item.due_date ?? '—'}</TableCell><TableCell>{label(item.status)}</TableCell>
              <TableCell><div className="flex flex-wrap gap-1">
                {available(item).map(action => <Button size="sm" variant="outline" key={action} onClick={() => open(action, item)}>{actions[action]}</Button>)}
                <Button size="sm" variant="ghost" onClick={() => { setEvents(undefined); setHistoryPage(1); setHistory(item); }}>History</Button>
              </div></TableCell>
            </TableRow>)}</TableBody></Table>
          <Paging page={detail.items} move={setItemPage} />
        </>}
      </section>}
      <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open && !busy) setEditor(undefined); }}>
        {editor && <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{actions[editor.action]}</DialogTitle>
            <DialogDescription>{editor.action === 'amend' ? 'Approval records a new version and requires fulfillment review again.' :
              editor.item?.title ?? 'Prepare a commitment for organizer approval.'}</DialogDescription></DialogHeader>
          <form onSubmit={save} className="grid gap-3">
            {termsActions.includes(editor.action) && <>
              <label>Title<Input required maxLength={200} value={terms.title} onChange={e => update('title', e.target.value)} /></label>
              <label>Description<Textarea required maxLength={4000} value={terms.description} onChange={e => update('description', e.target.value)} /></label>
              <label>Category<Input maxLength={80} value={terms.category} onChange={e => update('category', e.target.value)} /></label>
              <label>Due date<Input type="date" value={terms.due_date} onChange={e => update('due_date', e.target.value)} /></label>
              <label>Responsible employee<select required className={selectClass} value={terms.assigned_user_id} onChange={e => update('assigned_user_id', e.target.value)}>
                <option value="">Select an employee</option>{detail?.employees.map(e => <option key={e.id} value={e.id}>{e.name} (#{e.id})</option>)}
              </select></label>
              {can('documents.view') && <label>Contract reference<select className={selectClass} value={terms.document_id} onChange={e => update('document_id', e.target.value)}>
                <option value="">None</option>{detail?.documents.map(d => <option key={d.id} value={d.id}>{d.name} (#{d.id})</option>)}
              </select></label>}
              <label className="flex items-center gap-2"><input type="checkbox" checked={terms.required} onChange={e => update('required', e.target.checked)} /> Required commitment</label>
            </>}
            <label>{editor.action === 'submit' ? 'Completion claim and evidence reference' : editor.action === 'fulfill' ? 'Organizer verification note' : 'Internal note'}
              <Textarea required={noteActions.includes(editor.action)} maxLength={2000} value={note} onChange={e => {
                setNote(e.target.value);
                setEditor({ ...editor, requestId: crypto.randomUUID() });
              }} />
            </label>
            {actionError && <p role="alert" className="text-destructive">{actionError}</p>}
            <DialogFooter><Button type="submit" disabled={busy}>{actions[editor.action]}</Button></DialogFooter>
          </form>
        </DialogContent>}
      </Dialog>
      <Dialog open={Boolean(history)} onOpenChange={open => { if (!open) setHistory(undefined); }}>
        {history && <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Deliverable history</DialogTitle><DialogDescription>{history.title}</DialogDescription></DialogHeader>
          {!events && <p>Loading history…</p>}
          {events && <><ol className="space-y-3">{events.data.map(entry => <li key={entry.version} className="border-b pb-2">
            <strong>{actions[entry.action] ?? label(entry.action)} · {label(entry.status)}</strong>
            <div className="text-sm text-muted-foreground">Version {entry.version} · Employee #{entry.actor_id} · {new Date(entry.created_at).toLocaleString()}</div>
            {entry.details.note && <p className="whitespace-pre-wrap">{entry.details.note}</p>}
            {entry.details.terms && <dl className="mt-1 text-sm">{Object.entries(entry.details.terms).filter(([, value]) => value !== null).map(([key, value]) =>
              <div key={key}><dt className="inline font-medium">{label(key)} </dt><dd className="inline whitespace-pre-wrap">{key === 'required' ? (value ? 'Yes' : 'No') : String(value)}</dd></div>)}</dl>}
          </li>)}</ol><Paging page={events} move={setHistoryPage} /></>}
        </DialogContent>}
      </Dialog>
    </CardContent>
  </Card>;
}
