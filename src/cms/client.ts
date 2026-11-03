export interface CmsSite {slug:string;name:string;exhibition_id:number;public_origin:string}
export interface CmsResult {data:any;count?:number;error:null|{message:string;status?:number;errors?:Record<string,string[]>}}
export type CmsTransport=(path:string,method:string,body?:unknown)=>Promise<{data:any;count?:number;correlation_id?:string}>;
export interface CmsEvent {kind:'start'|'finish';operation:string;request_id:number;error?:string;success?:boolean}
export const cmsSections:Record<string,{title:string;family:string;resource?:string}>={
  overview:{title:'Website Overview',family:'website'},content:{title:'Page Content',family:'content',resource:'content'},
  settings:{title:'Site Settings',family:'settings',resource:'settings'},seo:{title:'SEO Settings',family:'seo',resource:'seo'},
  logo:{title:'Logo & Favicon',family:'branding',resource:'branding'},design:{title:'Design & Branding',family:'branding',resource:'branding'},
  photos:{title:'Photos & Media',family:'media',resource:'media'},packages:{title:'Exhibitor & Sponsor Packages',family:'packages',resource:'packages'},
  faqs:{title:'FAQs',family:'faqs',resource:'faqs'},language:{title:'Languages & Translations',family:'translations',resource:'translations'},
  blogs:{title:'Blogs',family:'blogs',resource:'blogs'},partners:{title:'Partners',family:'partners',resource:'partners'},
  location:{title:'Location & Public Event',family:'location',resource:'location'},
};
const settingSections:Record<string,string>={settings:'settings',seo:'seo',logo:'branding',design:'branding',location:'location',language:'language'};
const tableResources:Record<string,string>={page_content:'content',packages:'packages',faqs:'faqs',translations:'translations',photos:'media',blogs:'blogs',partners:'partners'};
export function cmsResource(section:string,table:string):string {
  const resource=table==='site_settings'?settingSections[section]:tableResources[table];
  const expected=cmsSections[section]?.resource;
  if(!resource||!(resource===expected||(section==='language'&&['language','translations'].includes(resource)))) throw new Error('This CMS resource is unavailable in the selected editor.');
  return resource;
}
export function publicCmsUrl(origin:string,value:string):string {
  if(value.startsWith('/')&&!value.startsWith('//'))return origin.replace(/\/$/,'')+value;
  return value;
}
type Filter={column:string;operator:'eq'|'neq'|'in';value:unknown};
type RecordData=Record<string,any>;
const reserved=new Set(['id','created_at','updated_at','_version']);
const identity=(resource:string):string[]=>['settings','seo','branding','location','language'].includes(resource)?['setting_key']:
  ({content:['page_name','section_name','content_key'],translations:['translation_key'],blogs:['slug']} as Record<string,string[]>)[resource]||[];

export function createCmsClient(transport:CmsTransport,site:CmsSite,section:string,onEvent:(event:CmsEvent)=>void=()=>{},readableSettings:string[]=['settings']) {
  const cache=new Map<string,Map<string,{raw:RecordData;display:RecordData}>>();
  const queues=new Map<string,Promise<CmsResult>>();
  const uploads=new Map<string,string>();
  let requiresReload=false,sequence=0;
  const base=`website-cms/${encodeURIComponent(site.slug)}`;
  const remember=(resource:string,row:RecordData)=>{
    const display={...row};
    for(const key of ['photo_url','logo_url','cover_image_url'])if(typeof display[key]==='string')display[key]=publicCmsUrl(site.public_origin,display[key]);
    if(['logo_url','favicon_url','og_image','twitter_image'].includes(row.setting_key)&&typeof row.setting_value==='string')display.setting_value=publicCmsUrl(site.public_origin,row.setting_value);
    if(!cache.has(resource))cache.set(resource,new Map());
    cache.get(resource)!.set(row.id,{raw:row,display});
    return display;
  };
  const match=(row:RecordData,filters:Filter[])=>filters.every(f=>f.operator==='eq'?row[f.column]===f.value:f.operator==='neq'?row[f.column]!==f.value:Array.isArray(f.value)&&f.value.includes(row[f.column]));
  const failure=(error:unknown):CmsResult=>{const e=error as {message?:string;status?:number;errors?:Record<string,string[]>};return {data:null,error:{message:e.message||'The CMS request failed.',status:e.status,errors:e.errors}};};

  class Query implements PromiseLike<CmsResult> {
    private operation='list';private records:unknown;private filters:Filter[]=[];
    private orders:{column:string;ascending:boolean}[]=[];private maximum=10000;private one=false;private promise?:Promise<CmsResult>;
    private resource:string;
    private resources:string[];
    constructor(table:string){this.resource=cmsResource(section,table);this.resources=section==='settings'&&table==='site_settings'?readableSettings.filter(value=>['settings','seo','branding','location','language'].includes(value)):[this.resource];}
    select(_columns='*',_options?:unknown){return this;}
    eq(column:string,value:unknown){this.filters.push({column,operator:'eq',value});return this;}
    neq(column:string,value:unknown){this.filters.push({column,operator:'neq',value});return this;}
    in(column:string,value:unknown[]){this.filters.push({column,operator:'in',value});return this;}
    order(column:string,options?:{ascending?:boolean}){this.orders.push({column,ascending:options?.ascending!==false});return this;}
    limit(value:number){this.maximum=Math.min(10000,Math.max(1,value));return this;}
    single(){this.one=true;this.maximum=1;return this;}
    insert(records:unknown){this.operation='create';this.records=records;return this;}
    update(records:unknown){this.operation='update';this.records=records;return this;}
    upsert(records:unknown,_options?:{onConflict?:string}){this.operation='upsert';this.records=records;return this;}
    delete(){this.operation='delete';return this;}
    private async run():Promise<CmsResult>{
      const operation=this.operation;
      const request_id=++sequence;
      onEvent({kind:'start',operation,request_id});
      try{
        if(operation==='list') {
          const all:RecordData[]=[];let total=0;
          for(const resource of this.resources){
          let offset=0,pageSize=Math.min(20,this.maximum),count=Number.POSITIVE_INFINITY;
          do {
            let result;
            try{result=await transport(`${base}/resources/${resource}`,'POST',{operation,filters:this.filters,orders:this.orders,limit:Math.min(pageSize,this.maximum-all.length),offset,expected_version:null});}
            catch(error){if((error as {status?:number}).status===413&&pageSize>1){pageSize=Math.max(1,Math.floor(pageSize/2));continue;}throw error;}
            if(!Array.isArray(result.data)||!Number.isInteger(result.count))throw new Error('The CMS returned an invalid list response.');
            count=result.count!;
            if(count>10000&&this.maximum===10000)throw new Error('This editor has more than 10,000 records. Use a narrower CMS filter.');
            for(const row of result.data)all.push(remember(resource,row));
            offset+=result.data.length;
            if(!result.data.length&&offset<Math.min(count,this.maximum))throw new Error('The CMS list changed while loading. Reload the editor.');
          }while(offset<count&&all.length<this.maximum);
          total+=count;if(all.length>=this.maximum)break;
          }
          onEvent({kind:'finish',operation,request_id,success:true});
          return {data:this.one?all[0]||null:all,count:total,error:null};
        }
        if(requiresReload)throw Object.assign(new Error('Reload this editor before another save. An earlier request conflicted or its outcome could not be confirmed.'),{status:409});
        const supplied=(Array.isArray(this.records)?this.records[0]:this.records||{}) as RecordData;
        if(Array.isArray(this.records)&&this.records.length!==1)throw new Error('Save one CMS record at a time.');
        const filters=operation==='upsert'?identity(this.resource).map(column=>({column,operator:'eq' as const,value:supplied[column]})):this.filters;
        if(operation==='upsert'&&!filters.length)throw new Error('This CMS resource has no supported upsert identity.');
        const candidates=this.resources.flatMap(resource=>[...(cache.get(resource)?.values()||[])].map(row=>({...row,resource})));
        const previous=operation==='create'?undefined:candidates.find(row=>filters.length>0&&match(row.raw,filters));
        const resource=previous?.resource||this.resource;
        if(['update','delete'].includes(operation)&&!previous)throw Object.assign(new Error('Reload the record before saving it.'),{status:409});
        const records:RecordData={};
        for(const [key,value] of Object.entries(supplied))if(!reserved.has(key))records[key]=previous&&value===previous.display[key]?previous.raw[key]:value;
        if(section==='location'&&previous)for(const field of ['category','setting_type','description'])if(field in previous.raw)records[field]=previous.raw[field];
        if(['update','upsert'].includes(operation)&&previous&&Object.entries(records).every(([key,value])=>JSON.stringify(value)===JSON.stringify(previous.raw[key]))){
          onEvent({kind:'finish',operation,request_id,success:true});return {data:this.one?previous.display:[previous.display],error:null};
        }
        const result=await transport(`${base}/resources/${resource}`,'POST',{operation,filters:this.filters,records,expected_version:previous?.raw._version||null});
        if(!Array.isArray(result.data))throw new Error('The CMS returned an invalid save response. Reload before retrying.');
        const rows=result.data.map(row=>remember(resource,row));
        if(operation==='delete'&&previous)cache.get(resource)?.delete(previous.raw.id);
        onEvent({kind:'finish',operation,request_id,success:true});
        return {data:this.one?rows[0]||null:rows,error:null};
      }catch(error){
        const result=failure(error);
        if(operation!=='list'&&[409,500,502,503].includes(result.error?.status||0))requiresReload=true;
        onEvent({kind:'finish',operation,request_id,error:result.error!.message,success:false});
        return result;
      }
    }
    then<TResult1=CmsResult,TResult2=never>(resolve?:((value:CmsResult)=>TResult1|PromiseLike<TResult1>)|null,reject?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):PromiseLike<TResult1|TResult2>{
      if(!this.promise){
        if(this.operation==='list')this.promise=this.run();
        else{
          const key=this.resource+':'+JSON.stringify(this.filters.length?this.filters:identity(this.resource).map(k=>(this.records as RecordData)?.[k]));
          this.promise=(queues.get(key)||Promise.resolve()).then(()=>this.run());
          queues.set(key,this.promise);
        }
      }
      return this.promise.then(resolve,reject);
    }
  }
  return {
    from:(table:string)=>new Query(table),
    storage:{from:(bucket:string)=>({
      async upload(path:string,file:File,_options?:unknown):Promise<CmsResult>{
        const request_id=++sequence;onEvent({kind:'start',operation:'upload',request_id});
        try{
          if(requiresReload)throw new Error('Reload the editor before uploading again.');
          const form=new FormData();form.append('file',file);form.append('bucket',bucket);
          const result=await transport(`${base}/uploads`,'POST',form);
          if(typeof result.data?.url!=='string')throw new Error('The CMS returned no image URL.');
          uploads.set(bucket+'/'+path,publicCmsUrl(site.public_origin,result.data.url));
          onEvent({kind:'finish',operation:'upload',request_id,success:true});return {data:result.data,error:null};
        }catch(error){const result=failure(error);onEvent({kind:'finish',operation:'upload',request_id,error:result.error!.message,success:false});return result;}
      },
      getPublicUrl(path:string){return {data:{publicUrl:uploads.get(bucket+'/'+path)||''}};},
    })},
  };
}
export type CmsClient=ReturnType<typeof createCmsClient>;
