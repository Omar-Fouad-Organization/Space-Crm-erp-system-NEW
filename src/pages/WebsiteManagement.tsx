import {useEffect,useState} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import {api,label} from '@/crm/api';
import {useAuth} from '@/contexts/AuthContext';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Label} from '@/components/ui/label';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {CmsProvider} from '@/cms/context';
import {cmsSections,type CmsSite} from '@/cms/client';
import Content from '@/cms/editors/Content';
import Settings from '@/cms/editors/Settings';
import SEO from '@/cms/editors/SEO';
import Logo from '@/cms/editors/Logo';
import Design from '@/cms/editors/Design';
import Photos from '@/cms/editors/Photos';
import Packages from '@/cms/editors/Packages';
import FAQs from '@/cms/editors/FAQs';
import Language from '@/cms/editors/Language';
import Blogs from '@/cms/editors/Blogs';
import Partners from '@/cms/editors/Partners';
import Location from '@/cms/editors/Location';

const editors:Record<string,React.ComponentType>={content:Content,settings:Settings,seo:SEO,logo:Logo,design:Design,photos:Photos,packages:Packages,faqs:FAQs,language:Language,blogs:Blogs,partners:Partners,location:Location};

function Overview({site}:{site:CmsSite}){
  const [counts,setCounts]=useState<Record<string,number>|null>(null),[error,setError]=useState(''),[version,setVersion]=useState(0);
  useEffect(()=>{let cancelled=false;setCounts(null);setError('');api<{data:Record<string,number>}>(`website-cms/${site.slug}/resources/overview`,'POST',{}).then(result=>{if(!cancelled)setCounts(result.data);}).catch(error=>{if(!cancelled)setError(error.message);});return()=>{cancelled=true;};},[site.slug,version]);
  return <div className="space-y-6"><Card className="crm-card"><CardHeader><CardTitle>{site.name}</CardTitle><CardDescription>The website CMS owns its content and public images. ERP controls employee access and the exhibition binding.</CardDescription></CardHeader><CardContent className="space-y-3"><p>These are counts of authorized CMS records, including drafts. They are not confirmed visitor, buyer, sponsor or exhibitor figures.</p><a href={site.public_origin} target="_blank" rel="noopener noreferrer" className="text-primary underline">Open public website</a></CardContent></Card>
    {error?<div role="alert" className="rounded border p-4"><p>{error}</p><Button variant="outline" className="mt-3" onClick={()=>setVersion(value=>value+1)}>Retry Website Overview</Button></div>:!counts?<p role="status" className="text-muted-foreground">Loading website CMS…</p>:Object.keys(counts).length?<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(counts).map(([resource,count])=><Card className="crm-card" key={resource}><CardHeader><CardDescription>{label(resource)} records</CardDescription><CardTitle>{count}</CardTitle></CardHeader></Card>)}</div>:<p className="text-muted-foreground">No CMS resource counts are permitted for your account. Choose an authorized editor.</p>}
  </div>;
}

export default function WebsiteManagement(){
  const {section='overview'}=useParams();const navigate=useNavigate();const {can}=useAuth();
  const [sites,setSites]=useState<CmsSite[]|null>(null),[selected,setSelected]=useState(''),[error,setError]=useState(''),[reload,setReload]=useState(0);
  useEffect(()=>{let cancelled=false;setSites(null);setError('');api<{data:CmsSite[]}>('website-cms/sites').then(result=>{if(!cancelled){setSites(result.data);setSelected(value=>result.data.some(site=>site.slug===value)?value:result.data[0]?.slug||'');}}).catch(error=>{if(!cancelled)setError(error.message);});return()=>{cancelled=true;};},[reload]);
  const site=sites?.find(site=>site.slug===selected),entry=cmsSections[section],Editor=editors[section];
  const allowed=entry&&can(entry.family+'.view');
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold text-crm-primary-text">Website Management</h1><p className="mt-1 text-crm-secondary-text">Manage permitted website content from your existing ERP workspace.</p></div>{!!sites?.length&&<div className="space-y-1"><Label htmlFor="cms-website">Website</Label><Select value={selected} onValueChange={setSelected}><SelectTrigger id="cms-website" className="w-[260px]"><SelectValue placeholder="Select website"/></SelectTrigger><SelectContent>{sites.map(site=><SelectItem key={site.slug} value={site.slug}>{site.name}</SelectItem>)}</SelectContent></Select></div>}</div>
    {error?<Card className="crm-card"><CardContent className="space-y-3 p-6"><p role="alert">{error}</p><Button variant="outline" onClick={()=>setReload(value=>value+1)}>Retry Website Connection</Button></CardContent></Card>:!sites?<p role="status" className="text-muted-foreground">Loading permitted websites…</p>:!site?<Card className="crm-card"><CardContent className="p-6">No website is assigned to your permitted exhibitions. Ask an administrator to review the explicit website binding and your exhibition access.</CardContent></Card>:<>
      <Tabs value={section} onValueChange={value=>navigate('/website/'+value)}><TabsList className="h-auto flex-wrap justify-start">{Object.entries(cmsSections).filter(([,item])=>can(item.family+'.view')).map(([key,item])=><TabsTrigger key={key} value={key}>{item.title}</TabsTrigger>)}</TabsList></Tabs>
      {!allowed?<Card className="crm-card"><CardContent className="p-6"><p role="alert">This website editor is unavailable or you do not have its view permission.</p></CardContent></Card>:<CmsProvider key={site.slug+section+reload} site={site} section={section} onReload={()=>setReload(value=>value+1)}>{section==='overview'?<Overview site={site}/>:Editor?<Editor/>:null}</CmsProvider>}
    </>}
  </div>;
}
