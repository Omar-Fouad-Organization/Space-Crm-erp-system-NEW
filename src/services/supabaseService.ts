import { supabase } from '@/integrations/supabase/client';

// Base interfaces
export interface Client {
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

export interface Exhibition {
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

export interface Booth {
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

export interface Deal {
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

export interface Task {
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

// Service classes
class BaseService<T> {
  constructor(protected tableName: string) {}

  async getAll(): Promise<T[]> {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Error fetching ${this.tableName}:`, error);
      return [];
    }
  }

  async getById(id: string): Promise<T | null> {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Error fetching ${this.tableName} by id:`, error);
      return null;
    }
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      const { data: result, error } = await supabase
        .from(this.tableName)
        .insert([data])
        .select()
        .single();
      
      if (error) throw error;
      return result;
    } catch (error) {
      console.error(`Error creating ${this.tableName}:`, error);
      throw error;
    }
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    try {
      const { data: result, error } = await supabase
        .from(this.tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    } catch (error) {
      console.error(`Error updating ${this.tableName}:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error(`Error deleting ${this.tableName}:`, error);
      throw error;
    }
  }
}

// Specific service implementations
export const clientService = new BaseService<Client>('clients_2026_01_17_19_00');
export const expoService = new BaseService<Exhibition>('exhibitions_2026_01_17_19_00');
export const boothService = {
  ...new BaseService<Booth>('booths_2026_01_17_19_00'),
  
  async updateStatus(id: string, status: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('booths_2026_01_17_19_00')
        .update({ status })
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error updating booth status:', error);
      throw error;
    }
  }
};
export const dealService = new BaseService<Deal>('deals_2026_01_17_19_00');
export const taskService = new BaseService<Task>('tasks_2026_01_17_19_00');

// Payment interface
export interface Payment {
  id: string;
  payment_number: string;
  invoice_number?: string;
  client_id: string;
  client_name: string;
  deal_id?: string;
  deal_name?: string;
  deal_type?: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  currency: string;
  payment_status: 'Pending' | 'Processing' | 'Completed' | 'Partial' | 'Failed' | 'Cancelled' | 'Refunded';
  payment_method?: string;
  due_date?: string;
  payment_date?: string;
  transaction_id?: string;
  reference_number?: string;
  notes?: string;
  description?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

// Payment Schedule interface
export interface PaymentSchedule {
  payment_schedule_id: string;
  deal_id: string;
  deal_number: string;
  deal_title: string;
  client_name: string;
  payment_name: string;
  scheduled_amount: string;
  currency: string;
  due_date?: string;
  paid_date?: string;
  payment_status: 'Pending' | 'Paid' | 'Overdue' | 'Cancelled';
  payment_method?: string;
  urgency_status?: string;
  days_until_due?: number;
  payment_description?: string;
  notes?: string;
}

// Payment Service
export const paymentService = new BaseService<Payment>('payments_2026_01_17_19_00');

// Payment Schedule Service
export const paymentScheduleService = {
  ...new BaseService<PaymentSchedule>('payment_schedules_2026_01_17_19_00'),
  
  async create(dealId: string, dealData: any, installments: any[]) {
    console.log('Creating payment schedules for deal:', dealId);
    // Mock implementation - in real app, this would create payment schedule records
    return Promise.resolve();
  }
};

// Commission Service
export const commissionService = {
  async createFromDeal(dealId: string, dealData: any, formData: any) {
    console.log('Creating commission schedules for deal:', dealId);
    // Mock implementation - in real app, this would create commission records
    return Promise.resolve();
  }
};