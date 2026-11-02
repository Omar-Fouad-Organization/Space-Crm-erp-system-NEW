import {useEffect,useState} from 'react';
import {useAuth} from '@/contexts/AuthContext';
import {useRecordOptions} from '@/hooks/useRecordOptions';
import {Label} from '@/components/ui/label';

export function useExhibitionField(open:boolean,id:string,initial?:{exhibition_id?:string|number|null}) {
  const {authorization,can}=useAuth();
  const enabled=!!authorization?.enabled&&can('exhibitions.view');
  const events=useRecordOptions('exhibitions',open&&enabled);
  const [value,setValue]=useState('');
  useEffect(()=>{if(open)setValue(String(initial?.exhibition_id||''));},[open,initial?.exhibition_id]);
  const field=enabled?<div className="space-y-2"><Label htmlFor={id}>Exhibition for work without a deal</Label><select id={id} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={value} onChange={e=>setValue(e.target.value)}><option value="">Use the related deal, or keep personal internal work</option>{events.map(event=><option key={event.id} value={event.id}>{event.name}</option>)}</select><p className="text-xs text-muted-foreground">Client-related work needs an exhibition or a related deal. Only your permitted exhibitions are available.</p></div>:null;
  return {field,payload:enabled?{exhibition_id:value||null}: {}};
}
