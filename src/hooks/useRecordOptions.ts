import {useEffect,useState} from 'react';
import {all,metadata,LegacyRecord} from '@/services/laravelClient';
import {toast} from '@/hooks/use-toast';
export function useRecordOptions(resource:string,enabled=true){
 const [rows,setRows]=useState<LegacyRecord[]>([]);
 useEffect(()=>{if(!enabled)return;let active=true;metadata().then(m=>m.resources[resource]?all(resource):[]).then(r=>{if(active)setRows(r);}).catch(error=>toast({title:'Unable to load options',description:error.message,variant:'destructive'}));return()=>{active=false;};},[resource,enabled]);
 return rows;
}
