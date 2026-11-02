import {useEffect} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
export function useQuickCreate(open:()=>void){
  const location=useLocation(),navigate=useNavigate();
  useEffect(()=>{const params=new URLSearchParams(location.search);if(params.get('create')==='1'){open();params.delete('create');navigate({pathname:location.pathname,search:params.toString()},{replace:true});}},[location.pathname,location.search,navigate,open]);
}
