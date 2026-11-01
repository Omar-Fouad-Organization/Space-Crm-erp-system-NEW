import React,{useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';
import {useAuth} from '@/contexts/AuthContext';
export function LoginDialog({open,onOpenChange}:{open:boolean;onOpenChange:(open:boolean)=>void}){
 const {login}=useAuth();const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Sign in to SPACE CRM</DialogTitle><DialogDescription>Use your workspace account to continue.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await login(email,password);onOpenChange(false);}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}><div><Label htmlFor="login-email">Email</Label><Input id="login-email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></div><div><Label htmlFor="login-password">Password</Label><Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></div>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<Button className="crm-button-primary w-full" disabled={busy}>{busy?'Signing in…':'Sign in'}</Button></form></DialogContent></Dialog>;
}
