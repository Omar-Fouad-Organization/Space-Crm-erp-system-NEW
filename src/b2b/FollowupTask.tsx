import {useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {api,label} from '@/crm/api';
import {Button} from '@/components/ui/button';
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog';

type Meeting={id:number;followup_task?:{id:number;title:string;status:string;due_date:string;assigned_employee:{id:number;name:string}|null}|null;followup_task_exists?:boolean;can_create_followup?:boolean};
type Context={meeting_id:number;version:number;exhibition_id:number;title:string;assigned_user_id:string;due_date:string|null;assignees:any[]};

export default function FollowupTask({meeting,onSaved}:{meeting:Meeting;onSaved:()=>void}) {
 const [context,setContext]=useState<Context|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const initial=useMemo(()=>context?{title:context.title,description:'',assigned_user_id:context.assigned_user_id,due_date:context.due_date||undefined,priority:'medium',deal_id:'',client_id:''}:undefined,[context]);
 const task=meeting.followup_task;
 const open=async()=>{setError('');setBusy(true);try{setContext(await api<Context>('b2b/followup-tasks/'+meeting.id));}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const save=async(data:any)=>{if(!context||busy)return false;setBusy(true);setError('');try{await api('b2b/followup-tasks/'+context.meeting_id,'POST',{version:context.version,exhibition_id:context.exhibition_id,name:data.title,description:data.description,assigned_user_id:Number(data.assigned_user_id),due_date:data.due_date,priority:data.priority,status:'pending'});setContext(null);onSaved();return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}};
 return <div className="space-y-2">
  {task?<><p>{task.title} · {label(task.status)} · Due {task.due_date}{task.assigned_employee?' · '+task.assigned_employee.name:''}</p><Button asChild size="sm" variant="outline"><Link to={'/tasks?task='+task.id}>Open Task</Link></Button></>:meeting.followup_task_exists?<p>Linked task unavailable for your permissions.</p>:meeting.can_create_followup?<><p>No CRM follow-up task linked.</p><Button size="sm" variant="outline" disabled={busy} onClick={open}>Create Follow-up Task</Button></>:null}
  {error&&<p role="alert" className="text-destructive">{error}</p>}
  <CreateTaskDialog open={!!context} onOpenChange={v=>!v&&setContext(null)} onSubmit={save} followup={context||undefined} initialData={initial}/>
 </div>;
}
