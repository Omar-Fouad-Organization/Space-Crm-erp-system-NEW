import {useEffect, useState} from 'react';
import {api, label} from '@/crm/api';
import {useAuth} from '@/contexts/AuthContext';
import {AuthorizationContract} from '@/auth/access';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Textarea} from '@/components/ui/textarea';

interface Entry {group: string; label: string; roles: string[]; protected: boolean;unavailable_reason?:string}
interface Staff {id: number; name: string; role: string; status: string}
interface Catalog {enabled: boolean; registry: Record<string,Entry>; users: Staff[]; exhibitions: {id:number;name:string}[]; teams:{id:number;name:string}[]}
interface Configuration {authorization_scoped:boolean;all_exhibitions:boolean;record_scope:string;team_id:number|null;exhibition_ids:number[];overrides:Record<string,boolean>}
interface Profile {user: Staff;version:number;configuration:Configuration;effective:AuthorizationContract;history:{id:number;user_id:number;created_at:string;action:string;after:string|null}[]}
const selectClass='w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export function AuthorizationPanel({initialUserId}: {initialUserId?: string}) {
  const {user,can}=useAuth();
  const [catalog,setCatalog]=useState<Catalog|null>(null), [selected,setSelected]=useState(initialUserId||'');
  const [profile,setProfile]=useState<Profile|null>(null), [draft,setDraft]=useState<Configuration|null>(null);
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [notice,setNotice]=useState(''), [search,setSearch]=useState('');
  const [password,setPassword]=useState(''), [code,setCode]=useState(''), [reason,setReason]=useState('');
  useEffect(()=>{let cancelled=false;if(!can('permissions.manage'))return;api<Catalog>('authorization/registry').then(value=>{
    if(cancelled)return;setCatalog(value);setSelected(old=>old||String(value.users.find(u=>u.role!=='super_admin')?.id||value.users[0]?.id||''));
  }).catch(e=>!cancelled&&setError(e.message));return()=>{cancelled=true;};},[]);
  useEffect(()=>{if(initialUserId)setSelected(initialUserId);},[initialUserId]);
  useEffect(()=>{
    let cancelled=false;setProfile(null);setDraft(null);setPassword('');setCode('');setNotice('');setError('');
    if(!catalog?.enabled||!selected)return;
    setBusy(true);api<Profile>('authorization/users/'+selected).then(value=>{if(!cancelled){setProfile(value);setDraft(structuredClone(value.configuration));}})
      .catch(e=>!cancelled&&setError(e.message)).finally(()=>!cancelled&&setBusy(false));
    return()=>{cancelled=true;};
  },[selected,catalog?.enabled]);
  if(!can('permissions.manage'))return <p role="alert">You do not have permission to manage employee access.</p>;
  if(!catalog)return <p role={error?'alert':'status'}>{error||'Loading permission registry…'}</p>;
  const staff=profile?.user||catalog.users.find(u=>String(u.id)===selected);
  const protectedUser=staff?.role==='super_admin'||String(staff?.id)===user?.id;
  const editable=!!draft&&catalog.enabled&&!protectedUser&&!busy;
  const change=(values:Partial<Configuration>)=>setDraft(old=>old?{...old,...values}:old);
  const entries=Object.entries(catalog.registry).filter(([key,entry])=>(entry.group+' '+entry.label+' '+key).toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-6">
    <Card className="crm-card"><CardHeader><CardTitle>Employee Access</CardTitle><CardDescription>Review role inheritance, exhibition access and individual exceptions. All record visibility remains limited by the selected exhibitions and record scope.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {!catalog.enabled&&<p role="status" className="rounded border p-3 text-sm">Granular authorization has not been activated. Existing role defaults remain in use. An approved schema-first rollout is required before editing access.</p>}
        <div><Label htmlFor="authorization-user">Employee</Label><select id="authorization-user" className={selectClass} value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)}>{catalog.users.map(u=><option key={u.id} value={u.id}>{u.name} · {label(u.role)} · {label(u.status)}</option>)}</select></div>
        {staff&&<p className="text-sm">Organizational role: <Badge variant="outline">{label(staff.role)}</Badge></p>}
        {protectedUser&&<p className="text-sm text-muted-foreground">Super Admin authority and your own security policy are protected from this editor.</p>}
        {staff?.role==='super_admin'&&<p className="text-sm">Super Admin has organization-wide exhibition access and protected administrative authority.</p>}
        {draft&&staff?.role!=='super_admin'&&<>
          <label className="flex items-center gap-2"><input type="checkbox" checked={draft.authorization_scoped} disabled={!editable||profile?.configuration.authorization_scoped} onChange={e=>change({authorization_scoped:e.target.checked})}/>Restrict this employee to assigned exhibitions</label>
          {!draft.authorization_scoped&&<p className="text-sm text-muted-foreground">Compatibility mode retains the employee’s existing exhibition visibility. Review their records and memberships before enrolling them in restricted access.</p>}
          <label className="flex items-center gap-2"><input type="checkbox" checked={draft.all_exhibitions} disabled={!editable||!draft.authorization_scoped} onChange={e=>change({all_exhibitions:e.target.checked})}/>Explicitly allow all exhibitions</label>
          <fieldset disabled={!editable||!draft.authorization_scoped||draft.all_exhibitions} className="rounded border p-3"><legend className="px-1 text-sm font-medium">Assigned exhibitions</legend><div className="grid gap-3 sm:grid-cols-2">{catalog.exhibitions.map(event=><label className="flex items-center gap-2" key={event.id}><input type="checkbox" checked={draft.exhibition_ids.includes(event.id)} onChange={e=>change({exhibition_ids:e.target.checked?[...draft.exhibition_ids,event.id]:draft.exhibition_ids.filter(id=>id!==event.id)})}/>{event.name}</label>)}</div></fieldset>
          {draft.authorization_scoped&&!draft.all_exhibitions&&!draft.exhibition_ids.length&&<p className="text-sm text-amber-700">No exhibitions are selected. This employee will not see event-owned records.</p>}
          <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="authorization-scope">Record visibility within allowed exhibitions</Label><select id="authorization-scope" className={selectClass} disabled={!editable} value={draft.record_scope} onChange={e=>change({record_scope:e.target.value})}><option value="all">All permitted records</option><option value="team">Team records</option><option value="own">Own records</option></select></div>
            <div><Label htmlFor="authorization-team">Team</Label><select id="authorization-team" className={selectClass} disabled={!editable} value={draft.team_id??''} onChange={e=>change({team_id:e.target.value?Number(e.target.value):null})}><option value="">No team</option>{catalog.teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select></div></div>
        </>}
      </CardContent></Card>
    <Card className="crm-card"><CardHeader><CardTitle>Effective Permissions</CardTitle><CardDescription>Inherited permissions come from the organizational role. Individual denials override role defaults. Protected security actions cannot be delegated.</CardDescription></CardHeader><CardContent className="space-y-4">
      <Input aria-label="Find a permission" placeholder="Find a permission or department…" value={search} onChange={e=>setSearch(e.target.value)}/>
      <div className="max-h-[520px] overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Permission</th><th className="p-2 text-left">Individual setting</th><th className="p-2 text-left">Saved effective access</th></tr></thead><tbody>{entries.map(([key,entry])=>{
        const saved=profile?.effective.permissions[key];
        const inherited=!entry.unavailable_reason&&(staff?.role==='super_admin'||(!entry.protected&&entry.roles.includes(staff?.role||'')));
        const effect=draft&&key in draft.overrides?(draft.overrides[key]?'allow':'deny'):'inherit';
        return <tr key={key} className="border-t"><td className="p-2"><div className="font-medium">{entry.label}</div><div className="text-xs text-muted-foreground">{entry.group}</div></td><td className="p-2"><select aria-label={entry.label+' individual setting'} className={selectClass} disabled={!editable||entry.protected||!!entry.unavailable_reason} value={effect} onChange={e=>{
          if(!draft)return;const next={...draft.overrides};if(e.target.value==='inherit')delete next[key];else next[key]=e.target.value==='allow';change({overrides:next});
        }}><option value="inherit">Inherit role</option><option value="allow">Grant individually</option><option value="deny">Deny individually</option></select></td><td className="p-2"><Badge variant="outline">{(saved?.allowed??inherited)?'Allowed':'Unavailable'} · {label(saved?.source||'inherited')}</Badge><p className="mt-1 text-xs text-muted-foreground">{saved?.reason||entry.unavailable_reason||(inherited?'Included in this role.':'Not included in this role.')}</p></td></tr>;
      })}</tbody></table></div>
    </CardContent></Card>
    {draft&&!protectedUser&&<Card className="crm-card"><CardHeader><CardTitle>Confirm Access Change</CardTitle><CardDescription>Saving revokes the employee’s existing sessions. They must sign in again. A conflicting administrator change requires a reload.</CardDescription></CardHeader><CardContent>
      <form className="space-y-4" onSubmit={async e=>{
        e.preventDefault();if(!profile||!draft)return;setBusy(true);setError('');setNotice('');
        try{
          const result=await api<Profile>('authorization/users/'+selected,'PUT',{...draft,version:profile.version,
            overrides:Object.entries(draft.overrides).map(([permission,allowed])=>({permission,effect:allowed?'allow':'deny'})),password,code:code||null,reason});
          setProfile(result);setDraft(structuredClone(result.configuration));setNotice('Access saved. The employee’s previous sessions have been revoked.');setReason('');
        }catch(error){setError((error as Error).message);}finally{setBusy(false);setPassword('');setCode('');}
      }}>
        <div><Label htmlFor="authorization-reason">Reason for change</Label><Textarea id="authorization-reason" required minLength={8} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="authorization-password">Your current password</Label><Input id="authorization-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></div><div><Label htmlFor="authorization-code">Your authenticator code, if enabled</Label><Input id="authorization-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/></div></div>
        <Button disabled={!editable||!password||reason.length<8}>{busy?'Saving…':'Save Employee Access'}</Button>
      </form>
    </CardContent></Card>}
    {error&&<p role="alert" className="text-destructive">{error} <Button variant="outline" size="sm" onClick={()=>{setCatalog(null);void api<Catalog>('authorization/registry').then(setCatalog).catch(e=>setError(e.message));}}>Reload</Button></p>}
    {notice&&<p role="status">{notice}</p>}
    {profile&&<Card className="crm-card"><CardHeader><CardTitle>Access Change History</CardTitle></CardHeader><CardContent className="space-y-3">{!profile.history.length&&<p className="text-sm text-muted-foreground">No access changes have been recorded for this employee.</p>}{profile.history.map(entry=>{
      let detail:{reason?:string}={};try{detail=JSON.parse(entry.after||'{}');}catch{}
      return <div key={entry.id} className="rounded border p-3 text-sm"><p>{label(entry.action)} · {catalog.users.find(u=>u.id===entry.user_id)?.name||'Administrator'} · {new Date(entry.created_at).toLocaleString()}</p>{detail.reason&&<p className="mt-1 text-muted-foreground">{detail.reason}</p>}</div>;
    })}</CardContent></Card>}
  </div>;
}
