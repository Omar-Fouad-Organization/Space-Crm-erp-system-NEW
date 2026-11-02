import React,{createContext,useContext,useEffect,useState} from 'react';
import {api} from '@/crm/api';
import {metadata,resetLegacyMetadata} from '@/services/laravelClient';
interface User {id:string;email:string;name:string;role:string;roles:string[]}
interface AuthContextType {user:User|null;roles:string[];hasRole:(role:string)=>boolean;hasPageAccess:(page:string)=>boolean;login:(email:string,password:string,code?:string)=>Promise<void>;logout:()=>Promise<void>;loading:boolean}
const AuthContext=createContext<AuthContextType|undefined>(undefined);
const pages:Record<string,string>={clients:'clients',deals:'deals',exhibitions:'exhibitions',booths:'booths',sponsorship:'sponsorship_packages',exhibitors:'deals',payments:'payments',proposals:'proposals',meetings:'meetings',hr:'employees',finance:'payments',tasks:'tasks',chat:'channels',support:'tickets',analytics:'deals',contracts:'documents','user-management':'users'};
export function AuthProvider({children}:{children:React.ReactNode}){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[resources,setResources]=useState<Record<string,unknown>>({});
 async function accept(value:any){resetLegacyMetadata();if(!value){setUser(null);setResources({});return;}const m=await metadata();setResources(m.resources);window.dispatchEvent(new CustomEvent('crm-settings-loaded',{detail:m.settings}));setUser({...value,id:String(value.id),roles:value.role==='super_admin'?['super_admin','management','hr','sales','user']:[value.role,'user']});}
 useEffect(()=>{api<any>('session').then(r=>accept(r.user)).catch(()=>void accept(null)).finally(()=>setLoading(false));const expired=()=>void accept(null);window.addEventListener('crm-signed-out',expired);return()=>window.removeEventListener('crm-signed-out',expired);},[]);
 const login=async(email:string,password:string,code?:string)=>{await api('session');const r=await api<any>('login','POST',{email,password,code});await accept(r.user);};
 const logout=async()=>{await api('logout','POST');await accept(null);};
 return <AuthContext.Provider value={{user,roles:user?.roles||[],loading,login,logout,hasRole:role=>!!user&&(user.role==='super_admin'||user.roles.includes(role)),hasPageAccess:page=>!!user&&(user.role==='super_admin'||['dashboard','notifications'].includes(page)||!!resources[pages[page]])}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used within an AuthProvider');return context;}
