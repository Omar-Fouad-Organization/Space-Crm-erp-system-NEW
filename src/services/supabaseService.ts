import { all, save, remove, LegacyRecord } from './laravelClient';
// Base interfaces
export interface Client extends LegacyRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  type: string;
  contact_person?: string;
  website?: string;
  industry?: string;
  company_size?: string;
  address?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  status?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface ClientMetrics {
  total_deals: number;
  active_deals: number;
  won_deals: number;
  total_value: number;
  won_value: number;
  avg_deal_size: number;
  conversion_rate: number;
  lifetime_value: number;
  open_tasks: number;
  overdue_payments: number;
  last_activity: string;
  engagement_score: number;
  satisfaction_score: number;
  growth_trend: 'up' | 'down' | 'stable';
}

export interface ClientActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  status: string;
  user: string;
  priority?: string;
}

export interface ClientDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  uploaded_at: string;
  uploaded_by: string;
  status: string;
  category: string;
}

export interface Exhibition extends LegacyRecord {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  location?: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface Booth extends LegacyRecord {
  price: number;
  id: string;
  booth_number?: string;
  booth_code: string;
  exhibition_id?: string;
  expo_name?: string;
  hall?: string;
  zone?: string;
  aisle?: string;
  position?: string;
  booth_type: string;
  size_sqm: number;
  width_m?: number;
  length_m?: number;
  height_m?: number;
  status: string;
  base_price: number;
  additional_costs?: number;
  total_price: number;
  currency: string;
  assigned_to_company?: string;
  assigned_to_contact?: string;
  assigned_to_email?: string;
  assigned_to_phone?: string;
  client_id?: string;
  features?: string[];
  power_supply?: string;
  internet_access?: boolean;
  water_supply?: boolean;
  compressed_air?: boolean;
  description?: string;
  notes?: string;
  special_requirements?: string;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export interface Deal extends LegacyRecord {
  id: string;
  title: string;
  description?: string;
  client_id: string;
  client_name?: string;
  exhibition_id?: string;
  deal_type: string;
  deal_value: number;
  status: string;
  stage: string;
  priority: 'High' | 'Medium' | 'Low';
  probability: number;
  created_by: string;
  created_by_name?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  created_at: string;
  updated_at?: string;
  close_date?: string;
  notes?: string;
  health_score?: number;
}

export interface Task extends LegacyRecord {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigned_to?: string;
  assigned_to_name?: string;
  due_date?: string;
  created_at: string;
  updated_at?: string;
}


class BaseService<T = LegacyRecord> {
 constructor(public resource:string){}
 async getAll():Promise<T[]>{return all(this.resource) as Promise<T[]>;}
 async getById(id:string):Promise<T|null>{return (await this.getAll()).find((r:any)=>String(r.id)===String(id))??null;}
 async create(data:Partial<T>|LegacyRecord):Promise<T>{return await save(this.resource,data) as T;}
 async update(id:string,data:Partial<T>):Promise<T>{return await save(this.resource,data,id) as T;}
 async delete(id:string){await remove(this.resource,id);}
}
export const clientService=new BaseService<Client>('clients');
export const expoService=new BaseService<Exhibition>('exhibitions');
export const boothService=Object.assign(new BaseService<Booth>('booths'),{async updateStatus(id:string,status:string){await save('booths',{status},id);}});
export const dealService=new BaseService<Deal>('deals');
export const taskService=new BaseService<Task>('tasks');
export const paymentService=new BaseService<any>('payments');
export const paymentScheduleService:any=Object.assign(new BaseService<any>('payment_schedules'),{async create(dealId:any,data?:any,installments?:any[]){if(typeof dealId==='object')return save('payment_schedules',dealId);const existing=(await all('payment_schedules')).filter(r=>r.deal_id===String(dealId));if(existing.length)return existing;throw new Error('Installments must be saved atomically with the deal.');}});
export const commissionService={async createFromDeal(dealId:string,..._args:any[]){return (await all('commissions')).filter(r=>r.deal_id===String(dealId));}};
export const settingsService={
 async getAllCommissionSchedules():Promise<any[]>{const [rows,deals]=await Promise.all([all('commissions'),all('deals')]);return rows.map(row=>({...row,client_name:deals.find(d=>d.id===row.deal_id)?.client_name||'',deal_amount:deals.find(d=>d.id===row.deal_id)?.deal_value||0,commission_percentage:Number(deals.find(d=>d.id===row.deal_id)?.commission_percentage||0)}));},
 async getCommissionSummary():Promise<any[]>{const rows=await this.getAllCommissionSchedules();return [...new Set(rows.map(r=>r.sales_person_id))].map(id=>{const data=rows.filter(r=>r.sales_person_id===id);const sum=(status?:string)=>data.filter(r=>!status||r.status===status).reduce((s,r)=>s+Number(r.commission_amount),0);return {sales_person_id:id,sales_person_name:data[0].sales_person_name,total_deals:data.length,total_commission_amount:sum(),paid_commission_amount:sum('paid'),pending_commission_amount:sum('pending'),approved_commission_amount:sum('approved'),disputed_commission_amount:sum('disputed')};});},
 async updateCommissionStatus(id:string,status:string,_paidAmount?:number,_method?:string,_notes?:string){await save('commissions',{status},id);return true;}
};
export type Payment = LegacyRecord;
export type PaymentSchedule = LegacyRecord;
export type CommissionSchedule = LegacyRecord;
export type CommissionSummary = LegacyRecord;
export default {clientService,expoService,boothService,dealService,taskService,paymentService,paymentScheduleService,commissionService,settingsService};

Object.assign(paymentScheduleService,{async updateStatus(id:string,status:string,paidDate?:string){const s=(await all('payment_schedules')).find(r=>r.id===String(id));if(!s)throw new Error('Installment not found.');if(status!=='paid')throw new Error('Installment status is calculated from receipts.');if(Number(s.remaining_amount)<=0)return s;return save('payments',{name:'PAY-'+crypto.randomUUID(),payment_schedule_id:id,amount:String(s.remaining_amount),paid_date:(paidDate||new Date().toISOString()).slice(0,10),method:'bank_transfer'});}});
