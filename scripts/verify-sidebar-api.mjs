import assert from 'node:assert/strict';
import fs from 'node:fs';
const password=process.env.CRM_ADMIN_PASSWORD;
if(!password)throw Error('Set CRM_ADMIN_PASSWORD before checking the local review workspace.');
const base=process.env.CRM_URL||'http://127.0.0.1:8080/api/';const cookies=new Map();let csrf='';let checks=0;
async function api(path,method='GET',body){const r=await fetch(new URL(path,base),{method,headers:{Accept:'application/json','Content-Type':'application/json',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(csrf?{'X-CSRF-TOKEN':csrf}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');cookies.set(p.slice(0,i),p.slice(i+1));}const data=await r.json();assert.equal(r.status,200,`${method} ${path}: ${JSON.stringify(data).slice(0,300)}`);if(data.csrf_token)csrf=data.csrf_token;checks++;return data;}
await api('session');await api('login','POST',{email:'admin@space.test',password});const meta=await api('metadata');const diagnostics=await api('diagnostics');
assert.equal(diagnostics.database,'MySQL');assert.equal(diagnostics.orphans.reduce((n,r)=>n+r.count,0),0);checks+=2;
const counts={};const records={};for(const resource of Object.keys(meta.resources)){const rows=(await api('records/'+resource)).data;counts[resource]=rows.length;records[resource]=rows;assert.ok(rows.length>0,resource+' retains review data');checks++;}
for(const id of [1,3,5]){const d=records.deals.find(d=>d.id===id);assert.equal(d.status,'closed_won');assert.equal(d.remaining_amount,'0.00');assert.equal(records.commissions.find(c=>c.deal_id===id).status,'paid');checks+=3;}
assert.ok(records.meetings.every(m=>m.attendee_ids.length===m.attendee_names.length));checks++;
const channel=records.channels.find(c=>c.name==='DUMMY SIDEBAR QA — Team');assert.ok(channel);assert.equal(channel.deal_id,3);assert.ok(records.messages.some(m=>m.channel_id===channel.id&&m.name.includes('sidebar QA message')));checks+=3;
const proposal=records.proposals.find(p=>p.name==='DUMMY SIDEBAR QA — Proposal');assert.ok(proposal);assert.equal(proposal.deal_id,3);assert.equal(proposal.status,'sent');assert.equal(proposal.expiryDate,'2026-12-31');checks+=4;
await api('dashboard');await api('notifications');await api('audit');await api('logout','POST');
const report={checkedAt:new Date().toISOString(),checks,counts,foreignKeys:diagnostics.orphans.length,brokenRelationships:0,reviewDeals:[1,3,5],chat:{channel:channel.id,deal:channel.deal_id},proposal:{id:proposal.id,deal:proposal.deal_id,status:proposal.status,expiry:proposal.expiryDate}};
if(process.env.CRM_REPORT_PATH)fs.writeFileSync(process.env.CRM_REPORT_PATH,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
