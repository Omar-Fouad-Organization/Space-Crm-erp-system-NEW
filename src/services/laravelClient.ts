import { api, ApiError } from '@/crm/api';

// Explicit boundary for the original UI's heterogeneous, dated record shapes.
export type LegacyRecord = Record<string, any>;
const tables: Record<string,string> = { exhibitions:'exhibitions', commission_schedules:'commissions', user_profiles:'users', sponsorship_packages:'sponsorship_packages' };
export const resourceName=(table:string)=>tables[table.replace(/_20\d\d_.*/, '')] || table.replace(/_20\d\d_.*/, '');
const title=(s:unknown)=>String(s ?? '').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
const slug=(s:unknown)=>String(s ?? '').trim().toLowerCase().replace(/[ -]+/g,'_');
let metadataPromise:Promise<any>|null=null;
export function resetLegacyMetadata(){ metadataPromise=null; }
export async function metadata(){ return metadataPromise ??= api<any>('metadata').catch(e=>{metadataPromise=null;throw e;}); }
export function legacyRow(resource:string,row:LegacyRecord):LegacyRecord {
  const r={...row};
  for(const [k,v] of Object.entries(r)) if((k==='id'||k.endsWith('_id')||k==='created_by')&&v!=null) r[k]=String(v);
  for(const key of ['amount','price','size_sqm','salary','budget','commission_percentage','paid_amount','remaining_amount']) if(r[key]!=null)r[key]=Number(r[key]);
  const common={title:r.name,full_name:r.name,description:r.description||'',created_by_name:r.created_by_label||'',assigned_to_name:r.salesperson_id_label||r.assigned_user_id_label||'',...r};
  if(resource==='clients')return {...common,company:r.company||r.name,company_name:r.company||r.name,contact_person:r.contact_person||'',type:title(r.type),status:title(r.status),phone:r.phone||'',industry:r.industry||'',email:r.email||''};
  if(resource==='exhibitions')return {...common,expo_number:r.expo_number||`EXPO-${r.id}`,venue_name:r.venue_name||r.location,city:r.city||r.location,priority:r.priority||'Medium',status:title(r.status),booth_count:r.booth_count||0,expected_visitors:r.expected_visitors||0,budget:Number(r.budget||0),manager_name:r.manager_id_label||r.manager_name||''};
  if(resource==='booths')return {...common,booth_code:r.name,booth_number:r.booth_number||r.name,expo_id:r.exhibition_id,expo_name:r.exhibition_id_label,booth_type:r.booth_type||'Standard',base_price:r.base_price??r.price,total_price:r.total_price??r.price,additional_costs:Number(r.additional_costs||0),features:r.features||[],status:title(r.status),client_name:r.client_id_label||r.assigned_to_company||''};
  if(resource==='deals')return {...common,title:r.name,deal_value:r.amount,value:r.amount,total_amount:r.amount,base_price:r.base_price??r.amount,commission_amount:Number(r.base_price??r.amount)*Number(r.commission_percentage||0)/100,stage:({lead_created:'talking',meeting:'meeting_scheduled',cancelled:'canceled'} as Record<string,string>)[r.status]||r.status,status:({lead_created:'Talking',meeting:'Meeting Scheduled',strategy_proposal:'Proposal',objection_handling:'Negotiation',terms_finalized:'Contract',cancelled:'Canceled'} as Record<string,string>)[r.status]||title(r.status),deal_type:r.type==='sponsor'?'sponsorship':r.type,package_id:r.booth_id||r.sponsorship_package_id,assigned_to:r.salesperson_id,sales_person_id:r.salesperson_id,assigned_salesperson_id:r.salesperson_id,assigned_to_name:r.salesperson_id_label||'',client_name:r.client_id_label||'',exhibition_name:r.exhibition_id_label||'',expo_name:r.exhibition_id_label||'',expo_id:r.exhibition_id,expected_value:r.amount,priority:r.priority||'Medium',probability:Number(r.probability??(r.status==='closed_won'?100:10)),health_score:Number(r.health_score??0),created_by_name:r.created_by_label||'',close_date:r.expected_close_date||'',payment_plan_type:r.payment_plan_type||'full_payment',installments:r.installments||[]};
  if(resource==='sponsorship_packages')return {...common,package_name:r.name,base_price:r.price,total_price:r.price,benefits:r.benefits||String(r.description||'').split('\n').filter(Boolean),package_type:r.package_type||'sponsor',is_exclusive:r.is_exclusive||false};
  if(resource==='payment_schedules')return {...common,payment_schedule_id:r.id,payment_name:r.name,payment_description:r.name,scheduled_amount:r.amount,payment_status:title(r.status),deal_title:r.deal_id_label||'',deal_number:`DEAL-${r.deal_id}`,client_name:r.client_name||'',urgency_status:r.status==='overdue'?'Overdue':'Normal',days_until_due:Math.ceil((new Date(r.due_date).getTime()-Date.now())/86400000)};
  if(resource==='payments')return {...common,payment_number:r.name,reference_number:r.name,total_amount:r.amount,paid_amount:r.amount,remaining_amount:0,payment_status:'Completed',payment_date:r.paid_date,payment_method:title(r.method),client_name:r.client_name||'',deal_name:r.deal_id_label||'',tags:r.tags||[]};
  if(resource==='commissions')return {...common,commission_name:r.name,commission_amount:r.amount,sales_person_id:r.salesperson_id,sales_person_name:r.salesperson_id_label,paid_amount:r.status==='paid'?r.amount:0,commission_percentage:Number(r.commission_percentage||0),due_date:r.due_date||String(r.created_at).slice(0,10),deal_title:r.deal_id_label||''};
  if(resource==='users')return {...common,full_name:r.name,role:r.original_role||({sales:'sales_executive',finance:'finance_officer'}[r.role]||r.role),permissions:r.permissions||[]};
  if(resource==='employees')return {...common,full_name:r.name,email:r.email||'',phone:r.phone||'',address:r.address||'',emergency_contact:r.emergency_contact||''};
  if(resource==='tasks'||resource==='tickets')return {...common,title:r.name,assigned_user:r.assigned_user_id?{id:r.assigned_user_id,full_name:r.assigned_user_id_label}:null,client:r.client_id?{id:r.client_id,company_name:r.client_id_label}:null,deal:r.deal_id?{id:r.deal_id,name:r.deal_id_label}:null,assigned_to:r.assigned_user_id,assigned_to_name:r.assigned_user_id_label||''};
  if(resource==='meetings')return {...common,title:r.name,date:r.meeting_date,time:String(r.meeting_time||'').slice(0,5),type:r.meeting_type||'Client Meeting',status:title(r.status),meetingType:r.meetingType||'In-Person',organizer:r.organizer_id_label||'',attendees:r.attendee_names||[],client:r.client_id_label||'',deal:r.deal_id_label||'',duration:Number(r.duration||60),agenda:r.agenda||'',notes:r.notes||'',priority:r.priority||'Medium',location:r.location||''};
  if(resource==='documents')return {...common,title:r.name,document_number:r.document_number||`DOC-${r.id}`,document_type:title(r.type),status:title(r.status),priority:r.priority||'Medium',client_name:r.client_id_label||'',deal_name:r.deal_id_label||'',tags:r.tags||[],attachments:(r.attachments||[]).map((a:any)=>({...a,id:String(a.id),url:`/api/attachments/${a.id}`,type:a.mime,uploaded_at:r.created_at,uploaded_by:r.created_by_label||''}))};
  if(resource==='proposals')return {...common,title:r.name,client:r.client_id_label||r.client_name||'',value:Number(r.amount||0),status:({sent:'pending',accepted:'approved'}[r.status]||r.status),createdDate:String(r.created_at).slice(0,10),expiryDate:r.expiryDate||''};
  return common;
}
export async function all(resource:string):Promise<LegacyRecord[]> {
  const rows=(await api<{data:LegacyRecord[]}>(`records/${resource}`)).data;
  return rows.map(row=>legacyRow(resource,row));
}
async function resolve(resource:string,value:unknown):Promise<string|null>{
  if(value==null||value==='')return null;
  const rows=await all(resource);const found=rows.filter(r=>r.id===String(value)||r.name===value||r.full_name===value||r.title===value);
  if(found.length!==1)throw new Error(`Choose an existing ${resource.replaceAll('_',' ')} record; the reference '${value}' is ${found.length?'ambiguous':'not found'}.`);
  return String(found[0].id);
}
export async function save(resource:string,input:LegacyRecord,id?:string):Promise<LegacyRecord>{
  const meta=await metadata();const fields=meta.resources[resource]?.fields;if(!fields)throw new Error('You do not have access to this module.');
  const previous=id?(await api<any>(`records/${resource}/${id}`)).data:{};
  const r={...previous,...input}; const data:LegacyRecord={};
  if(resource==='booths'&&id&&input.status&&slug(input.status)!==previous.status)throw new Error('Booth allocation status follows its related deal. Update the deal to reserve, sell, or release this booth.');
  const aliases:Record<string,any>={currency:input.currency??r.currency,name:input.title??input.full_name??input.company_name??input.booth_code??input.package_name??input.payment_name??input.payment_number??input.commission_name??input.name??r.name,
    exhibition_id:input.exhibition_id??input.expo_id??r.exhibition_id,
    salesperson_id:input.salesperson_id??input.assigned_salesperson_id??input.sales_person_id??input.assigned_to??r.salesperson_id??meta.user.id,
    assigned_user_id:input.assigned_user_id??input.assigned_to??r.assigned_user_id??meta.user.id,
    organizer_id:input.organizer_id??(input.organizer==='Current User'?undefined:input.organizer)??r.organizer_id??meta.user.id,
    client_id:input.client_id??input.client_name??input.client??r.client_id,
    deal_id:input.deal_id??input.deal_name??input.deal??r.deal_id,
    amount:input.amount??input.deal_value??input.negotiated_value??input.expected_value??input.scheduled_amount??input.commission_amount??input.total_amount??r.amount,
    price:input.price??input.total_price??input.base_price??r.price,
    location:input.location??input.venue_name??input.city??r.location,
    type:input.deal_type??input.document_type??input.type??r.type,
    status:input.stage??input.payment_status??input.status??r.status,
    expected_close_date:input.expected_close_date??input.close_date??r.expected_close_date,
    meeting_date:input.meeting_date??input.date??r.meeting_date,
    meeting_time:String(input.meeting_time??input.time??r.meeting_time??'').slice(0,5),
    method:input.method??input.payment_method??r.method,
    paid_date:input.paid_date??input.payment_date??r.paid_date,
    payment_schedule_id:input.payment_schedule_id??r.payment_schedule_id,
  };
  if(resource==='deals') {
    const type=slug(aliases.type); aliases.type=type==='sponsorship'?'sponsor':type;
    aliases.booth_id=input.booth_id??(aliases.type==='booth'?input.package_id:null)??r.booth_id;
    aliases.sponsorship_package_id=input.sponsorship_package_id??(aliases.type!=='booth'?input.package_id:null)??r.sponsorship_package_id;
    if(!id) {
      const plan=typeof input.installments==='string'?JSON.parse(input.installments):input.installments;
      if(input.payment_plan_type==='installments'&&plan?.length)data.installments=plan.map((x:any,i:number)=>({name:x.name||x.description||`Installment ${i+1}`,amount:String(x.amount),due_date:x.due_date}));
      if(input.payment_plan_type==='full_payment')data.installments=[{name:'Full payment',amount:String(aliases.amount),due_date:String(aliases.expected_close_date||new Date().toISOString()).slice(0,10)}];
    }
    if(!aliases.currency&&aliases.booth_id)aliases.currency=(await all('booths')).find(b=>b.id===String(aliases.booth_id))?.currency;
  }
  if(resource==='payments'&&!aliases.payment_schedule_id){
    const dealId=await resolve('deals',aliases.deal_id);
    const available=(await all('payment_schedules')).filter(s=>s.deal_id===dealId&&s.remaining_amount>0);
    if(available.length!==1)throw new Error('Select an installment from the Payment Schedules tab before recording a receipt.');
    aliases.payment_schedule_id=available[0].id;
  }
  if(resource==='employees')aliases.user_id=input.user_id??(input.email?await resolve('users', (await all('users')).find(u=>u.email===input.email)?.id ?? input.full_name):r.user_id);
  if(resource==='users'){
    const role=String(input.role??r.role);aliases.role=({sales_manager:'sales',sales_executive:'sales',finance_manager:'finance',finance_officer:'finance'} as Record<string,string>)[role]||role;
    if(!id&&!input.password)throw new Error('Enter a password of at least 12 characters. Passwords are not generated or emailed silently.');
  }
  for(const [key,f] of Object.entries(fields) as [string,any][]){
    let value=aliases[key]??r[key]??f.default??null;
    if(f.type==='relation')value=await resolve(f.resource,value);
    if(f.type==='select')value=key==='currency'?String(value||'EGP').toUpperCase():slug(value);
    if(f.type==='date'&&value)value=String(value).slice(0,10);
    if(resource==='deals'&&key==='status')value=({meeting_scheduled:'meeting',canceled:'cancelled',proposal:'strategy_proposal',negotiation:'objection_handling',contract:'terms_finalized'} as Record<string,string>)[value]||value;
    if(resource==='proposals'&&key==='status')value=({pending:'sent',approved:'accepted'} as any)[value]||value;
    if(resource==='documents'&&key==='status')value=({under_review:'review',pending_signature:'review',expired:'archived'} as any)[value]||value;
    if(resource==='booths'&&key==='status')continue;
    if(key==='currency')value=value||'EGP';
    if(key==='method')value=({bank:'bank_transfer',credit_card:'card',check:'cheque'} as any)[value]||value;
    if(value===''||value===undefined)value=null;
    data[key]=value;
  }
  // Preserve the original ancillary form fields; canonical relationships remain explicit foreign keys.
  const blocked=/(?:password|token|permission|created_by|user_id|client_id|deal_id|booth_id|exhibition_id|salesperson_id|package_id|schedule_id|manager_id|organizer_id|channel_id)$/i;
  data.attributes=Object.fromEntries(Object.entries(input).filter(([k,v])=>!fields[k]&&!blocked.test(k)&&k!=='id'&&k!=='attributes'&&k!=='attachments'&&k!=='installments'&&v!==undefined));
  if(resource==='users')data.attributes.original_role=input.role;
  if(resource==='meetings'){
    const names=input.attendees;
    if(names)data.attendee_ids=await Promise.all((Array.isArray(names)?names:String(names).split(',')).filter(Boolean).map((name:string)=>resolve('users',name.trim())));
  }
  const result=await api<{data:LegacyRecord}>(`records/${resource}${id?'/'+id:''}`,id?'PUT':'POST',data);
  window.dispatchEvent(new CustomEvent('crm-record-saved',{detail:{resource,id:result.data.id}}));
  return legacyRow(resource,result.data);
}
export const remove=async(resource:string,id:string)=>{await api(`records/${resource}/${id}`,'DELETE');window.dispatchEvent(new CustomEvent('crm-record-saved',{detail:{resource,id}}));};

class LaravelQuery implements PromiseLike<any> {
  private resource:string; private filters:[string,unknown][]=[];private operation='read';private payload:any;private one=false;private options:any;private max=Infinity;
  constructor(table:string){this.resource=resourceName(table);}
  select(_columns?:string,options?:any){this.options=options;return this;}
  eq(key:string,value:unknown){this.filters.push([key,value]);return this;}
  order(..._args:any[]){return this;}
  limit(n:number){this.max=n;return this;}
  single(){this.one=true;return this;}
  maybeSingle(){this.one=true;return this;}
  insert(payload:any){this.operation='insert';this.payload=Array.isArray(payload)?payload[0]:payload;return this;}
  update(payload:any){this.operation='update';this.payload=payload;return this;}
  delete(){this.operation='delete';return this;}
  async execute(){try{
    let rows:LegacyRecord[];
    if(this.operation==='insert')rows=[await save(this.resource,this.payload)];
    else {rows=(await all(this.resource)).filter(r=>this.filters.every(([key,value])=>String(r[key])===String(value))).slice(0,this.max);
      if(this.operation==='update')rows=await Promise.all(rows.map(r=>save(this.resource,this.payload,r.id)));
      if(this.operation==='delete'){for(const r of rows)await remove(this.resource,r.id);rows=[];}
    }
    return {data:this.options?.head?null:this.one?rows[0]??null:rows,error:null,count:rows.length};
  }catch(error){return{data:null,error:error instanceof ApiError?error:new Error((error as Error).message),count:0};}}
  then<TResult1=any,TResult2=never>(onfulfilled?:((value:any)=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):PromiseLike<TResult1|TResult2>{return this.execute().then(onfulfilled,onrejected);}
}
export const laravelClient={from:(table:string)=>new LaravelQuery(table)};
