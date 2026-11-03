import React,{createContext,useContext,useMemo,useRef,useState} from 'react';
import {useAuth} from '@/contexts/AuthContext';
import {api} from '@/crm/api';
import {Button as ErpButton} from '@/components/ui/button';
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle} from '@/components/ui/alert-dialog';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {createCmsClient,cmsSections,type CmsClient,type CmsSite,type CmsEvent} from './client';

interface EditorContext {client:CmsClient;site:CmsSite;section:string;can:(action:string)=>boolean;changed:()=>void;confirmDelete:(message:string)=>Promise<boolean>;notice:(message:string)=>void}
const Context=createContext<EditorContext|null>(null);
export function useCmsEditor(){const context=useContext(Context);if(!context)throw new Error('CMS editor context is required.');return context;}
export const useCmsClient=()=>useCmsEditor().client;
export const useCmsPreview=()=>{const editor=useCmsEditor();return {refreshSEOData:()=>editor.notice('SEO saved in the website CMS. Public pages will read it on refresh; ERP metadata is unchanged.')};};

export function CmsProvider({site,section,onReload,children}:{site:CmsSite;section:string;onReload:()=>void;children:React.ReactNode}){
  const {can}=useAuth();const [pending,setPending]=useState(0),[error,setError]=useState(''),[dirty,setDirty]=useState(false),[saved,setSaved]=useState(''),[notice,setNotice]=useState('');
  const [confirmation,setConfirmation]=useState('');const resolver=useRef<((value:boolean)=>void)|null>(null);const revision=useRef(0),started=useRef(new Map<number,number>());
  React.useEffect(()=>()=>resolver.current?.(false),[]);
  const client=useMemo(()=>createCmsClient((path,method,body)=>api(path,method,body),site,section,(event:CmsEvent)=>{
    if(event.kind==='start'){setPending(value=>value+1);started.current.set(event.request_id,revision.current);return;}
    const began=started.current.get(event.request_id);started.current.delete(event.request_id);setPending(value=>Math.max(0,value-1));
    if(event.error){setError(event.error);if(event.operation!=='list')setDirty(true);return;}
    if(event.operation!=='list'&&event.success){setSaved(new Date().toLocaleTimeString());if(event.operation==='upload')setDirty(true);else if(began===revision.current)setDirty(false);}
  },Object.entries({settings:'settings',seo:'seo',branding:'branding',location:'location',language:'translations'}).filter(([,family])=>can(family+'.view')).map(([resource])=>resource)),[site.slug,section]);
  const finish=(value:boolean)=>{resolver.current?.(value);resolver.current=null;setConfirmation('');};
  const confirmDelete=(message:string)=>new Promise<boolean>(resolve=>{resolver.current?.(false);resolver.current=resolve;setConfirmation(message);});
  const family=cmsSections[section].family;
  return <Context.Provider value={{client,site,section,can:action=>can(family+'.'+action),changed:()=>{revision.current++;setDirty(true);},confirmDelete,notice:setNotice}}>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><p role="status">{pending?'CMS request in progress…':dirty?'Unsaved input or an incomplete operation remains.':saved?`Last successful save: ${saved}`:'Changes are saved only after a successful confirmation.'}</p><ErpButton size="sm" variant="outline" onClick={async()=>{if(!dirty||await confirmDelete('Reload this editor? Unsaved input will be discarded.'))onReload();}}>Reload Editor</ErpButton></div>
      {!can(family+'.edit')&&!can(family+'.create')&&section!=='overview'&&<p className="rounded border p-3 text-sm">Read-only access. Saving, publication and uploads need their separate permissions.</p>}
      {!can(family+'.publish')&&section!=='overview'&&<p className="rounded border p-3 text-sm">You do not have publication permission. Draft blog or inactive record changes may be saved with their editing permission; live content and settings changes require publication authority.</p>}
      {['settings','content'].includes(section)&&<p className="rounded border p-3 text-sm text-muted-foreground">Confirm promotional dates and figures before publishing. Existing CMS statistics are not verification of attendance or exhibitors.</p>}
      {error&&<div role="alert" className="rounded border border-destructive p-3 text-sm"><p className="text-destructive">{error}</p><p>Earlier changes may have saved. Review the editor and reload after a conflict or an uncertain save; failed writes are never retried automatically.</p></div>}
      {notice&&<p role="status" className="rounded border p-3 text-sm">{notice}</p>}
      {children}
    </div>
    <AlertDialog open={!!confirmation} onOpenChange={open=>{if(!open)finish(false);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm Website Change</AlertDialogTitle><AlertDialogDescription>{confirmation}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={()=>finish(false)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={()=>finish(true)}>Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </Context.Provider>;
}

export function CmsEditorFrame({children}:{children:React.ReactNode}){
  const {changed}=useCmsEditor();return <section className="space-y-6" onChangeCapture={changed}>{children}</section>;
}
type CmsButtonProps=React.ComponentProps<typeof ErpButton>&{cmsAction?:'create'|'edit'|'delete'|'upload'|'publish'|'write'};
export const Button=React.forwardRef<HTMLButtonElement,CmsButtonProps>(({cmsAction,disabled,...props},ref)=>{
  const {can,section}=useCmsEditor();const auth=useAuth();const live=['content','settings','seo','branding','location','translations'].includes(cmsSections[section].family);
  const allowed=(!cmsAction||(cmsAction==='upload'?auth.can('media.upload'):cmsAction==='write'?(can('edit')||can('create')):can(cmsAction)))&&(!cmsAction||cmsAction==='upload'||!live||can('publish'));
  return <ErpButton ref={ref} {...props} disabled={disabled||!allowed}/>;
});
Button.displayName='CmsButton';

function escapeAttribute(value:string){return value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
export function CmsHtmlPreview({html,arabic}:{html:string;arabic:string}){
  const {site}=useCmsEditor();const [language,setLanguage]=useState('en');
  const source=language==='ar'?arabic||html:html;
  const origin=escapeAttribute(site.public_origin.replace(/\/$/,''));
  const document=`<!doctype html><html lang="${language}" dir="${language==='ar'?'rtl':'ltr'}"><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http:; style-src 'unsafe-inline'; base-uri ${origin}; form-action 'none'"><base href="${origin}/"><style>body{font-family:system-ui;margin:16px;overflow-wrap:anywhere}img{max-width:100%;height:auto}</style></head><body>${source}</body></html>`;
  return <Card className="crm-card"><CardHeader><CardTitle>Isolated HTML Preview</CardTitle></CardHeader><CardContent><Tabs value={language} onValueChange={setLanguage}><TabsList><TabsTrigger value="en">English</TabsTrigger><TabsTrigger value="ar">العربية</TabsTrigger></TabsList><TabsContent value={language}><iframe title="Isolated blog preview" sandbox="" referrerPolicy="no-referrer" className="h-80 w-full rounded-md border bg-white" srcDoc={document}/></TabsContent></Tabs></CardContent></Card>;
}
