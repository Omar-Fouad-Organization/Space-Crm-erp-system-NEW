import React,{createContext,useContext,useEffect,useState} from 'react';
import {api} from '@/crm/api';
import {metadata,resetLegacyMetadata} from '@/services/laravelClient';
import {AuthorizationContract,permitted} from '@/auth/access';
interface User {id:string;email:string;name:string;role:string;roles:string[];mfa_confirmed_at?:string}
interface AuthContextType {user:User|null;roles:string[];authorization:AuthorizationContract|null;can:(permission:string)=>boolean;hasRole:(role:string)=>boolean;hasPageAccess:(page:string)=>boolean;login:(email:string,password:string,code?:string)=>Promise<void>;logout:()=>Promise<void>;loading:boolean}
const AuthContext=createContext<AuthContextType|undefined>(undefined);
const pages:Record<string,string>={submissions:'submissions.view',buyers:'buyers.view',visitors:'visitors.view','registration-controls':'registrations.configure','registration-delivery':'registrations.deliveries','website-management':'website.view',clients:'clients.view',deals:'deals.view',exhibitions:'exhibitions.view',booths:'booths.view',sponsorship:'sponsorship_packages.view',exhibitors:'deals.view',payments:'payments.view',proposals:'proposals.view',meetings:'meetings.view',hr:'employees.view',finance:'finance.view',commissions:'commissions.view',tasks:'tasks.view',chat:'channels.view',support:'tickets.view',analytics:'deals.view',advanced:'advanced.view',contracts:'documents.view','user-management':'users.manage',settings:'system.settings',dashboard:'dashboard.view'};
export function AuthProvider({children}:{children:React.ReactNode}){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[resources,setResources]=useState<Record<string,unknown>>({});
 const [authorization,setAuthorization]=useState<AuthorizationContract|null>(null);
 async function accept(value:any){resetLegacyMetadata();if(!value){setUser(null);setResources({});setAuthorization(null);return;}const m=await metadata();setResources(m.resources);setAuthorization(m.authorization);window.dispatchEvent(new CustomEvent('crm-settings-loaded',{detail:m.settings}));setUser({...value,id:String(value.id),roles:value.role==='super_admin'?['super_admin','management','hr','sales','user']:[value.role,'user']});}
 useEffect(()=>{api<any>('session').then(r=>accept(r.user)).catch(()=>void accept(null)).finally(()=>setLoading(false));const expired=()=>void accept(null);window.addEventListener('crm-signed-out',expired);return()=>window.removeEventListener('crm-signed-out',expired);},[]);
 const login=async(email:string,password:string,code?:string)=>{await api('session');const r=await api<any>('login','POST',{email,password,code});await accept(r.user);};
 const logout=async()=>{await api('logout','POST');await accept(null);};
 const can=(permission:string)=>!!user&&permitted(authorization,permission);
 return <AuthContext.Provider value={{user,authorization,can,roles:user?.roles||[],loading,login,logout,hasRole:role=>!!user&&(user.role==='super_admin'||user.roles.includes(role)),hasPageAccess:page=>!!user&&(['notifications'].includes(page)||can(pages[page]||'unregistered.page'))}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used within an AuthProvider');return context;}
