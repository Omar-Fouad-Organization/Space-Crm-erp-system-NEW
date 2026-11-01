// Exercises the actual original-form adapter against the local Laravel/MySQL app.
// Retains fictional review records. Never resets or reseeds the review database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const password=process.env.CRM_ADMIN_PASSWORD;
if(!password)throw Error('Set CRM_ADMIN_PASSWORD.');
const helper=`
export class ApiError extends Error {constructor(message,status){super(message);this.status=status;}}
const jar=new Map();let csrf='';
export async function api(path,method='GET',body){
 const form=body instanceof FormData;
 const res=await fetch(new URL(path,${JSON.stringify(process.env.CRM_URL||'http://127.0.0.1:8080/api/')}),{method,headers:{Accept:'application/json',...(!form?{'Content-Type':'application/json'}:{}),Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(csrf?{'X-CSRF-TOKEN':csrf}:{})},...(body===undefined?{}:{body:form?body:JSON.stringify(body)})});
 for(const cookie of res.headers.getSetCookie()){const p=cookie.split(';')[0],i=p.indexOf('=');jar.set(p.slice(0,i),p.slice(i+1));}
 const text=await res.text();const data=text?JSON.parse(text):null;
 if(data?.csrf_token)csrf=data.csrf_token;
 if(!res.ok)throw new ApiError(JSON.stringify(data),res.status);
 return data;
}`;
const url='data:text/javascript;base64,'+Buffer.from(helper).toString('base64');
const {api}=await import(url);
await api('session');await api('login','POST',{email:'admin@space.test',password});
globalThis.window={dispatchEvent(){}};
globalThis.CustomEvent??=class{constructor(type,options){this.type=type;this.detail=options?.detail;}};
const source=fs.readFileSync(new URL('../src/services/laravelClient.ts',import.meta.url),'utf8').replace("'@/crm/api'",JSON.stringify(url));
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.ESNext}}).outputText;
const {save,all,remove}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const tag='DUMMY RESTORED';const records={};let checks=0;
async function create(resource,input){const row=await save(resource,input);(records[resource]??=[]).push(row.id);checks++;return row;}
async function rejected(fn){await assert.rejects(fn);checks++;}
if((await all('deals')).some(d=>d.title===`${tag} — Full original UI cycle`))throw Error('Retained cycle already exists; refusing to duplicate it.');
const admin=(await all('users')).find(u=>u.email==='admin@space.test');
const client=await create('clients',{name:`${tag} — Client`,company:'Delta Exhibitions LLC',contact_person:'Dummy Contact',email:'restored@example.test',type:'Exhibitor',status:'Active',city:'Cairo',website:'https://example.test',company_size:'11-50',notes:'Fictional original form adapter review.'});
assert.equal((await all('clients')).find(c=>c.id===client.id).company,'Delta Exhibitions LLC');checks++;
const expo=await create('exhibitions',{name:`${tag} — Expo`,start_date:'2026-12-15',end_date:'2026-12-17',venue_name:'Dummy Cairo Hall',city:'Cairo',country:'Egypt',theme:'Original interface QA',status:'Planning',budget:100000,currency:'EGP',manager_name:admin.name,tags:['dummy','restored']});
for(const status of ['Marketing','Registration Open','Active'])await save('exhibitions',{status},expo.id);
const booth=await create('booths',{booth_code:'RESTORED-A01',exhibition_id:expo.id,size_sqm:25,total_price:10000,currency:'EGP',booth_type:'Premium',features:['Electricity','WiFi'],hall:'A',zone:'Technology'});
const pack=await create('sponsorship_packages',{package_name:`${tag} — Gold`,expo_id:expo.id,tier:'gold',price:5000,currency:'EGP',benefits:['Logo','Speaking slot']});
let deal=await create('deals',{title:`${tag} — Full original UI cycle`,client_id:client.id,exhibition_id:expo.id,deal_type:'booth',package_id:booth.id,assigned_to:admin.id,base_price:10000,discount_percentage:10,tax_percentage:14,deal_value:10260,total_amount:10260,commission_percentage:5,currency:'EGP',stage:'talking',priority:'High',payment_plan_type:'installments',installments:JSON.stringify([{description:'Deposit',amount:4260,due_date:'2026-11-10'},{description:'Balance',amount:6000,due_date:'2026-12-01'}]),terms_conditions:'Dummy terms retained from original form',special_requirements:'Dummy booth setup'});
assert.equal((await all('booths')).find(b=>b.id===booth.id).status,'Reserved');checks++;
await rejected(()=>save('deals',{title:'INVALID duplicate allocation',client_id:client.id,exhibition_id:expo.id,deal_type:'booth',package_id:booth.id,assigned_to:admin.id,deal_value:10000,commission_percentage:5,stage:'talking'}));
const proposal=await create('proposals',{title:`${tag} — Proposal`,deal_id:deal.id,status:'pending',content:'Dummy booth proposal. No legal agreement.'});
await save('proposals',{status:'approved'},proposal.id);
const task=await create('tasks',{title:`${tag} — Setup task`,client_id:client.id,deal_id:deal.id,assigned_user_id:admin.id,due_date:'2026-12-10',priority:'high',status:'pending',description:'Verify related records.'});
await save('tasks',{status:'completed'},task.id);
const meeting=await create('meetings',{title:`${tag} — Kickoff`,client:client.name,deal:deal.title,organizer:admin.name,date:'2026-11-05',time:'10:00',duration:60,type:'Client Meeting',meetingType:'In-Person',status:'Scheduled',priority:'High',attendees:[admin.name],agenda:'Review terms'});
await save('meetings',{status:'Completed',notes:'Dummy meeting completed.'},meeting.id);
const document=await create('documents',{title:`${tag} — Contract`,client_name:client.name,deal_name:deal.title,document_type:'Contract',status:'Draft',priority:'High',tags:['dummy'],notes:'Fictional document, no legal signature.'});
const form=new FormData();form.set('file',new Blob(['Dummy attachment retained for review.'],{type:'text/plain'}),'restored-review.txt');
const attachment=await api(`documents/${document.id}/attachments`,'POST',form);
await save('documents',{status:'Signed'},document.id);
const ticket=await create('tickets',{title:`${tag} — Support`,client_id:client.id,deal_id:deal.id,assigned_user_id:admin.id,priority:'medium',status:'open',issue_type:'technical',description:'Dummy support request'});
await save('tickets',{status:'resolved',resolution_notes:'Relationships verified.'},ticket.id);
await save('tickets',{status:'closed'},ticket.id);
const channel=await create('channels',{name:`${tag} — Team`,deal_id:deal.id});
await create('messages',{name:'Dummy relationship review complete.',channel_id:channel.id});
for(const stage of ['meeting_scheduled','strategy_proposal','objection_handling','terms_finalized','closed_won']){deal=await save('deals',{stage},deal.id);checks++;}
await save('deals',{deal_notes:[{id:'review',content:'Original notes field persisted.',author:admin.name,timestamp:new Date().toISOString(),type:'note'}]},deal.id);
const schedules=(await all('payment_schedules')).filter(s=>s.deal_id===deal.id);
assert.equal(schedules.length,2);checks++;
const commission=(await all('commissions')).find(c=>c.deal_id===deal.id);
assert.equal(commission.commission_amount,500);checks++;
await rejected(()=>save('commissions',{status:'approved'},commission.id));
await rejected(()=>save('payments',{payment_number:'INVALID overpayment',payment_schedule_id:schedules[0].id,total_amount:Number(schedules[0].amount)+0.01,payment_date:'2026-11-01',payment_method:'Bank Transfer'}));
for(const s of schedules)await create('payments',{payment_number:`RESTORED-PAY-${s.id}`,payment_schedule_id:s.id,total_amount:s.amount,payment_date:'2026-11-01',payment_method:'Bank Transfer',notes:'Fictional receipt, no funds moved.'});
await save('commissions',{status:'approved'},commission.id);await save('commissions',{status:'paid'},commission.id);
const invoice=await create('invoices',{name:`RESTORED-INV-${deal.id}`,deal_id:deal.id,due_date:'2026-12-01'});
assert.equal(invoice.status,'paid');checks++;
await create('deals',{title:`${tag} — Sponsorship`,client_id:client.id,exhibition_id:expo.id,deal_type:'sponsorship',package_id:pack.id,assigned_to:admin.id,deal_value:5000,currency:'EGP',commission_percentage:5,stage:'strategy_proposal',payment_plan_type:'full_payment'});
await rejected(()=>remove('clients',client.id));
await rejected(()=>save('deals',{amount:10261},deal.id));
const final=(await all('deals')).find(d=>d.id===deal.id);
assert.equal(final.remaining_amount,0);assert.equal(final.terms_conditions,'Dummy terms retained from original form');assert.equal(final.deal_notes[0].content,'Original notes field persisted.');checks+=3;
assert.equal((await all('booths')).find(b=>b.id===booth.id).status,'Sold');checks++;
for(const resource of Object.keys((await api('metadata')).resources)){assert.ok((await all(resource)).length>0,resource);checks++;}
await api('audit');await api('dashboard');await api('exhibitors');
const report={completedAt:new Date().toISOString(),checks,records,deal:deal.id,client:client.id,exhibition:expo.id,booth:booth.id,attachment:attachment.data?.id,amount:10260,commission:500,remaining:0};
fs.writeFileSync(process.env.CRM_REPORT_PATH||'../original-ui-cycle-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
await api('logout','POST');
