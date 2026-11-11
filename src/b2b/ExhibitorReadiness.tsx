import {useEffect, useState} from 'react';
import {api, label} from '@/crm/api';
import {useAuth} from '@/contexts/AuthContext';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';

type Requirement = {
  id?: number;
  version: number;
  title_en: string;
  title_ar?: string;
  description_en?: string;
  description_ar?: string;
  type: string;
  required: boolean;
  active: boolean;
  due_date?: string;
  display_order: number;
};
type Result = Requirement & {
  requirement_version: number;
  status: string;
  response?: string;
  feedback?: string;
  history?: {id:number; previous_status:string; status:string; employee_id:number|null; created_at:string; details:{reason?:string}}[];
};
type Exhibitor = {
  deal_id:number; client_id:number; booth_id:number; client:string; booth:{name:string};
  status:string; completed:number; applicable:number; review:number; pending:number; items:Result[];
  handover?:{employee_id:number; created_at:string; note?:string};
};
type Data = {requirements:Requirement[]; data:Exhibitor[]; total:number};
const blank:Requirement = {version:0, title_en:'', type:'information', required:false, active:true, display_order:0};
const itemStatuses = ['not_started','awaiting_information','submitted','under_review','changes_requested','approved','not_applicable'];

export default function ExhibitorReadiness({event}:{event:string}) {
  const {can} = useAuth();
  const [data, setData] = useState<Data>();
  const [filters, setFilters] = useState({search:'',status:'',item_status:'',due:''});
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<Requirement|null>(null);
  const [decision, setDecision] = useState<{deal:number; item:Result; action:string}|null>(null);
  const [handover, setHandover] = useState<Exhibitor|null>(null);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const base = 'b2b/readiness/'+event;
  useEffect(() => {
    let active = true;
    setData(undefined);
    api<Data>(base+'?'+new URLSearchParams({...applied,page:String(page)}))
      .then(result => { if (active) setData(result); })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [base, applied, page, refresh]);
  async function save(path:string, body:unknown) {
    setBusy(true);
    setError('');
    try {
      await api(base+path, 'POST', body);
      setEditor(null);
      setDecision(null);
      setHandover(null);
      setRefresh(value => value+1);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return <Card><CardHeader><CardTitle>Exhibitor operational readiness</CardTitle></CardHeader><CardContent className="space-y-4">
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {data && !data.requirements.some(item => item.active) && <p>Operational requirements not configured.</p>}
    {can('b2b.readiness.configure') && <>
      <Button variant="outline" onClick={() => setEditor(blank)}>Add requirement</Button>
      {data?.requirements.map(item => <div className="flex flex-wrap items-center gap-3" key={item.id}>
        <span>{item.title_en} · {label(item.type)} · {item.active?'Active':'Inactive'}</span>
        <Button size="sm" variant="outline" onClick={() => setEditor(item)}>Edit</Button>
      </div>)}
    </>}
    {editor && <form className="space-y-3 border rounded-lg p-4" onSubmit={e => {e.preventDefault(); void save('/requirements', editor);}}>
      {(['title_en','title_ar','description_en','description_ar'] as const).map(key => <label className="block" key={key}>{label(key)}
        <Input required={key==='title_en'} maxLength={key.startsWith('title')?200:1000} value={editor[key]??''} onChange={e => setEditor({...editor,[key]:e.target.value})}/>
      </label>)}
      <label className="block">Type <select value={editor.type} onChange={e => setEditor({...editor,type:e.target.value})}>
        {['information','document','organizer_approval'].map(type => <option key={type} value={type}>{label(type)}</option>)}
      </select></label>
      <label className="block">Due date<Input type="date" value={editor.due_date??''} onChange={e => setEditor({...editor,due_date:e.target.value})}/></label>
      <label className="block">Display order<Input type="number" min="0" max="10000" value={editor.display_order} onChange={e => setEditor({...editor,display_order:Number(e.target.value)})}/></label>
      <div className="flex gap-4">{(['required','active'] as const).map(key => <label key={key}>
        <input type="checkbox" checked={Boolean(editor[key])} onChange={e => setEditor({...editor,[key]:e.target.checked})}/> {label(key)}
      </label>)}</div>
      <Button disabled={busy}>Save requirement</Button> <Button type="button" variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
    </form>}
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => {e.preventDefault();setPage(1);setApplied({...filters});}}>
      <label>Booth or exhibitor<Input value={filters.search} onChange={e => setFilters({...filters,search:e.target.value})}/></label>
      <label>Readiness <select value={filters.status} onChange={e => setFilters({...filters,status:e.target.value})}>
        <option value="">All</option>{['not_configured','pending','ready','not_applicable'].map(s => <option key={s} value={s}>{label(s)}</option>)}
      </select></label>
      <label>Requirement status <select value={filters.item_status} onChange={e => setFilters({...filters,item_status:e.target.value})}>
        <option value="">All</option>{itemStatuses.map(s => <option key={s} value={s}>{label(s)}</option>)}
      </select></label>
      <label>Due on or before<Input type="date" value={filters.due} onChange={e => setFilters({...filters,due:e.target.value})}/></label>
      <Button variant="outline">Apply filters</Button>
    </form>
    {data?.data.length===0 && <p>No confirmed exhibitors match these filters.</p>}
    {data?.data.map(row => <section key={row.deal_id} className="space-y-3 border rounded-lg p-4">
      <h3 className="font-semibold">{row.client} · {row.booth?.name}</h3>
      <p>{label(row.status)} · {row.completed}/{row.applicable} completed · {row.pending} pending · {row.review} for review</p>
      {row.items.map(item => <div key={item.id} className="space-y-2 border-t pt-2">
        <p>{item.title_en} · {label(item.status)}{!item.active && ' · Inactive'}{item.due_date && ' · Due '+item.due_date}</p>
        {item.type==='document' && <p>Document completion is unavailable.</p>}
        {item.response && <p className="whitespace-pre-wrap break-words">{item.response}</p>}
        {item.feedback && <p className="whitespace-pre-wrap break-words">{item.feedback}</p>}
        {item.active && can('b2b.readiness.review') && !['approved','not_applicable'].includes(item.status) && <div className="flex flex-wrap gap-2">
          {[
            ...(item.status==='submitted'?['review']:[]),
            ...(['submitted','under_review'].includes(item.status)?['approve','request_changes']:[]),
            ...(item.type==='organizer_approval' && item.status==='not_started'?['approve']:[]),
            'not_applicable',
          ].map(action => <Button size="sm" variant="outline" key={action} onClick={() => {
            setReason('');setFeedback('');setDecision({deal:row.deal_id,item,action});
          }}>{label(action)}</Button>)}
        </div>}
        {!!item.history?.length && <details><summary>Decision history</summary>{item.history.map(entry => <p key={entry.id}>
          {entry.created_at} · {entry.employee_id?'Employee #'+entry.employee_id:'Exhibitor representative'} · {label(entry.previous_status)} → {label(entry.status)} {entry.details.reason}
        </p>)}</details>}
      </div>)}
      {row.handover ? <p>Handover recorded by employee #{row.handover.employee_id} · {row.handover.created_at}{row.handover.note && ' · '+row.handover.note}</p>
        : can('b2b.readiness.handover') && <Button variant="outline" onClick={() => {setReason('');setHandover(row);}}>Record Booth Handover</Button>}
    </section>)}
    {decision && <form className="space-y-3 border rounded-lg p-4" onSubmit={e => {
      e.preventDefault();
      void save('/'+decision.deal+'/review', {requirement_id:decision.item.id, requirement_version:decision.item.requirement_version,
        version:decision.item.version, action:decision.action, reason, feedback});
    }}>
      <p>{label(decision.action)} · {decision.item.title_en}</p>
      <label className="block">Internal reason<Input required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)}/></label>
      {decision.action==='request_changes' && <label className="block">Message to exhibitor<Input required maxLength={500} value={feedback} onChange={e => setFeedback(e.target.value)}/></label>}
      <Button disabled={busy}>Save decision</Button> <Button type="button" variant="outline" onClick={() => setDecision(null)}>Cancel</Button>
    </form>}
    {handover && <form className="space-y-3 border rounded-lg p-4" onSubmit={e => {
      e.preventDefault();void save('/'+handover.deal_id+'/handover', {booth_id:handover.booth_id,client_id:handover.client_id,note:reason});
    }}>
      <p>Confirm physical handover · {handover.client} · {handover.booth.name}</p>
      <label className="block">Internal note<Input maxLength={2000} value={reason} onChange={e => setReason(e.target.value)}/></label>
      <Button disabled={busy}>Confirm handover</Button> <Button type="button" variant="outline" onClick={() => setHandover(null)}>Cancel</Button>
    </form>}
    {data && <div className="flex gap-3">
      <Button variant="outline" disabled={page===1} onClick={() => setPage(page-1)}>Previous</Button>
      <span>Page {page} · {data.total} exhibitors</span>
      <Button variant="outline" disabled={page*20>=data.total} onClick={() => setPage(page+1)}>Next</Button>
    </div>}
  </CardContent></Card>;
}
