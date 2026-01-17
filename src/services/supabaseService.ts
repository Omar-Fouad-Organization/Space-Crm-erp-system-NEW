import { supabase } from '@/integrations/supabase/client';

// Base interfaces
export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  country?: string;
  created_at: string;
  updated_at?: string;
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
  booth_number: string;
  booth_code: string;
  size_sqm: number;
  base_price: number;
  total_price: number;
  status: string;
  booth_type: string;
  currency?: string;
  exhibition_id?: string | null;
  created_at: string;
  updated_at?: string;
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
export const clientService = new BaseService<Client>('clients_2026_01_10_12_00');
export const expoService = new BaseService<Exhibition>('exhibitions_2026_01_10_12_00');
export const boothService = new BaseService<Booth>('booths_2026_01_10_12_00');
export const dealService = new BaseService<Deal>('deals_2026_01_10_12_00');
export const taskService = new BaseService<Task>('tasks_2026_01_10_12_00');

// Payment Schedule Service
export const paymentScheduleService = {
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