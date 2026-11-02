import {useEffect, useRef, useState} from 'react';
import {useAuth} from '@/contexts/AuthContext';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';

export function usePrivilegeConfirmation() {
  const {authorization}=useAuth();
  const [open,setOpen]=useState(false),[password,setPassword]=useState(''),[code,setCode]=useState('');
  const pending=useRef<((value:Record<string,string>|null)=>void)|null>(null);
  useEffect(()=>()=>{pending.current?.(null);},[]);
  const finish=(value:Record<string,string>|null)=>{pending.current?.(value);pending.current=null;setOpen(false);setPassword('');setCode('');};
  const confirm=()=>!authorization?.enabled?Promise.resolve({} as Record<string,string>):new Promise<Record<string,string>|null>(resolve=>{pending.current?.(null);pending.current=resolve;setOpen(true);});
  const dialog=<Dialog open={open} onOpenChange={value=>{if(!value)finish(null);}}><DialogContent><DialogHeader><DialogTitle>Confirm Staff Account Change</DialogTitle><DialogDescription>Enter your current password and authenticator code, if enabled. These credentials are used only to confirm this change.</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={e=>{e.preventDefault();finish({confirm_password:password,confirm_code:code});}}>
      <div><Label htmlFor="staff-confirm-password">Your current password</Label><Input id="staff-confirm-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></div>
      <div><Label htmlFor="staff-confirm-code">Your authenticator code, if enabled</Label><Input id="staff-confirm-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value)}/></div>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>finish(null)}>Cancel</Button><Button disabled={!password}>Confirm Change</Button></div>
    </form>
  </DialogContent></Dialog>;
  return {confirm,dialog};
}
