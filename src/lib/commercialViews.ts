export type ViewRow=Record<string,any>;
export type MoneyGroups=Record<string,number>|null;
export const sameId=(a:unknown,b:unknown)=>a!=null&&b!=null&&String(a)===String(b);
export const stage=(d:ViewRow)=>String(d.stage||d.status||'').toLowerCase().replaceAll(' ','_');
export const openDeal=(d:ViewRow)=>!['closed_won','closed_lost','cancelled','canceled','failed'].includes(stage(d));
export function linkedBoothDeal(booth:ViewRow,deals:ViewRow[]):ViewRow|undefined {
 return deals.find(d=>sameId(d.booth_id,booth.id)&&!['closed_lost','cancelled','canceled','failed'].includes(stage(d)));
}
export function moneyGroups(rows:ViewRow[],key='deal_value'):MoneyGroups {
 const cents:Record<string,number>={};
 for(const row of rows){const n=row[key];if(n==null||n===''||!Number.isFinite(Number(n))||!row.currency)return null;cents[row.currency]=(cents[row.currency]||0)+Math.round(Number(n)*100);}
 return Object.fromEntries(Object.entries(cents).map(([c,n])=>[c,n/100]));
}
export function moneyLabel(amount:unknown,currency:unknown):string {
 if(amount==null||amount===''||!Number.isFinite(Number(amount))||!currency)return 'Not available';
 return new Intl.NumberFormat('en-US',{style:'currency',currency:String(currency)}).format(Number(amount));
}
export function totalsLabel(groups:MoneyGroups):string {
 if(groups===null)return 'Not available';
 const values=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).map(([c,n])=>moneyLabel(n,c));
 return values.join(' · ')||'No recorded revenue';
}
export function recordedMetric(value:unknown):number|null {return value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);}
export function metricLabel(value:unknown,suffix=''):string {const n=recordedMetric(value);return n===null?'Not recorded':n.toLocaleString('en-US')+suffix;}
export function exhibitionProjection(exhibition:ViewRow,booths:ViewRow[],deals:ViewRow[]) {
 const related=booths.filter(b=>sameId(b.exhibition_id,exhibition.id));
 const won=deals.filter(d=>sameId(d.exhibition_id,exhibition.id)&&stage(d)==='closed_won');
 const booked=related.filter(b=>['reserved','sold','confirmed','occupied'].includes(String(b.status).toLowerCase())).length;
 const partyCount=(booth:boolean)=>new Set(won.filter(d=>((d.deal_type||d.type)==='booth')===booth).map(d=>d.client_id).filter(v=>v!=null).map(String)).size;
 return {totalBooths:related.length,bookedBooths:booked,totalRevenue:moneyGroups(won),occupancyRate:related.length?booked/related.length*100:0,sponsors:partyCount(false),exhibitors:partyCount(true)};
}
export function dashboardProjection(raw:ViewRow,exhibition:string,cutoff:string) {
 const allDeals:ViewRow[]=raw.deals.filter((d:ViewRow)=>exhibition==='all'||sameId(d.exhibition_id,exhibition));
 const ids=new Set(allDeals.map(d=>String(d.id)));
 const deals=allDeals.filter(d=>String(d.created_at).slice(0,10)>=cutoff),won=deals.filter(d=>stage(d)==='closed_won'),open=deals.filter(openDeal);
 const currency=raw.meta.settings.currency;
 const revenue=moneyGroups(won.filter(d=>d.currency===currency));
 const grouped:Record<string,number>={};
 for(const p of raw.payments.filter((p:ViewRow)=>p.currency===currency&&String(p.paid_date).slice(0,10)>=cutoff&&(exhibition==='all'||ids.has(String(p.deal_id))))){const month=String(p.paid_date).slice(0,7);grouped[month]=(grouped[month]||0)+Math.round(Number(p.amount)*100);}
 return {deals,won,open,revenue,ids,topDeals:open.filter(d=>d.currency===currency&&d.deal_value!=null).sort((a,b)=>Number(b.deal_value)-Number(a.deal_value)).slice(0,3),revenueData:Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([month,amount])=>({month,revenue:amount/100,deals:deals.filter(d=>String(d.created_at).slice(0,7)===month).length}))};
}
export async function dashboardRecords(meta:ViewRow,all:(name:string)=>Promise<ViewRow[]>,cash:()=>Promise<ViewRow[]>) {
 const canCash=meta.authorization?.permissions['finance.view']?.allowed===true;
 const read=(name:string)=>meta.resources[name]?(name==='payments'?(canCash?cash():Promise.resolve([])):all(name)):Promise.resolve([]);
 const [deals,clients,tasks,payments,exhibitions]=await Promise.all(['deals','clients','tasks','payments','exhibitions'].map(read));
 return {deals,clients,tasks,payments,exhibitions,meta,canCash};
}
