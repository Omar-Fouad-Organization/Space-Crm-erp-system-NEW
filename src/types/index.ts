// SPACE CRM System - Core Types
// Enterprise-grade type definitions for all modules

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  last_login?: string;
  permissions?: Permission[];
}

export type UserRole = 
  | 'super_admin' 
  | 'management' 
  | 'sales_manager' 
  | 'sales_executive' 
  | 'finance_manager' 
  | 'finance_officer' 
  | 'operations' 
  | 'support' 
  | 'client';

export interface Permission {
  id: string;
  module: string;
  action: 'view' | 'edit' | 'create' | 'delete' | 'approve' | 'export';
  level: 'module' | 'record' | 'own_records';
}

export interface Expo {
  id: string;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface Client {
  id: string;
  type: 'exhibitor' | 'sponsor' | 'sector_sponsor';
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  industry: string;
  notes?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface Booth {
  id: string;
  booth_code: string;
  expo_id: string;
  hall: string;
  zone: string;
  size_sqm: number;
  price_per_meter: number;
  total_price: number;
  status: 'available' | 'reserved' | 'sold';
  created_at: string;
  updated_at: string;
  expo?: Expo;
}

export interface SponsorshipPackage {
  id: string;
  name: string;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  base_price: number;
  benefits: string[];
  is_exclusive: boolean;
  package_type: 'sponsor' | 'sector_sponsor';
  created_at: string;
  updated_at: string;
}

export type DealStatus = 
  | 'lead_created'
  | 'talking'
  | 'meeting'
  | 'strategy_proposal'
  | 'objection_handling'
  | 'terms_finalized'
  | 'closed_won'
  | 'closed_lost'
  | 'failed'
  | 'cancelled';

export interface Deal {
  id: string;
  name: string;
  client_id: string;
  expo_id: string;
  type: 'booth' | 'sponsor' | 'sector_sponsor';
  status: DealStatus;
  assigned_salesperson_id: string;
  expected_value: number;
  negotiated_value?: number;
  expected_close_date: string;
  booth_id?: string;
  sponsorship_package_id?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  
  // Relations
  client?: Client;
  expo?: Expo;
  booth?: Booth;
  sponsorship_package?: SponsorshipPackage;
  assigned_salesperson?: User;
  payments?: Payment[];
  tasks?: Task[];
  documents?: Document[];
  notes?: DealNote[];
}

export interface Payment {
  id: string;
  deal_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_date?: string;
  payment_method?: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  deal?: Deal;
}

export interface Commission {
  id: string;
  salesperson_id: string;
  deal_id: string;
  payment_id: string;
  commission_percentage: number;
  commission_amount: number;
  status: 'pending' | 'payable' | 'paid';
  created_at: string;
  updated_at: string;
  salesperson?: User;
  deal?: Deal;
  payment?: Payment;
}

export interface Proposal {
  id: string;
  deal_id: string;
  template_name: string;
  content: string;
  include_vat: boolean;
  vat_percentage: number;
  status: 'draft' | 'sent' | 'signed';
  sent_date?: string;
  signed_date?: string;
  signature_data?: string;
  created_at: string;
  updated_at: string;
  deal?: Deal;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigned_user_id: string;
  created_by_id: string;
  deal_id?: string;
  client_id?: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  assigned_user?: User;
  created_by?: User;
  deal?: Deal;
  client?: Client;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  client_id: string;
  deal_id?: string;
  issue_type: 'technical' | 'billing' | 'general' | 'complaint';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assigned_user_id?: string;
  sla_due_date: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
  client?: Client;
  deal?: Deal;
  assigned_user?: User;
}

export interface ChatChannel {
  id: string;
  name: string;
  type: '1_to_1' | 'group' | 'deal_context';
  deal_id?: string;
  members: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'file' | 'system';
  file_url?: string;
  file_name?: string;
  created_at: string;
  sender?: User;
}

export interface Document {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  deal_id?: string;
  client_id?: string;
  uploaded_by: string;
  created_at: string;
  deal?: Deal;
  client?: Client;
  uploaded_by_user?: User;
}

export interface DealNote {
  id: string;
  deal_id: string;
  content: string;
  created_by: string;
  created_at: string;
  created_by_user?: User;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'payment_due' | 'task_overdue' | 'deal_status_change' | 'commission_release' | 'contract_signed';
  is_read: boolean;
  related_id?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  created_at: string;
  user?: User;
}

// Dashboard & Reporting Types
export interface DashboardKPI {
  label: string;
  value: number | string;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  format?: 'currency' | 'percentage' | 'number';
}

export interface ChartData {
  name: string;
  value: number;
  [key: string]: any;
}

// Form Types
export interface CreateUserForm {
  full_name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  password?: string;
}

export interface CreateExpoForm {
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  status: 'planning' | 'active';
  notes?: string;
}

export interface CreateClientForm {
  type: 'exhibitor' | 'sponsor' | 'sector_sponsor';
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  industry: string;
  notes?: string;
}

export interface CreateBoothForm {
  booth_code: string;
  expo_id: string;
  hall: string;
  zone: string;
  size_sqm: number;
  price_per_meter: number;
}

export interface CreateSponsorshipPackageForm {
  name: string;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  base_price: number;
  benefits: string[];
  is_exclusive: boolean;
  package_type: 'sponsor' | 'sector_sponsor';
}

export interface CreateDealForm {
  name: string;
  client_id: string;
  expo_id: string;
  type: 'booth' | 'sponsor' | 'sector_sponsor';
  assigned_salesperson_id: string;
  expected_value: number;
  expected_close_date: string;
}

export interface CreatePaymentForm {
  deal_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  payment_method?: string;
}

export interface CreateTaskForm {
  title: string;
  description?: string;
  assigned_user_id: string;
  deal_id?: string;
  client_id?: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface CreateTicketForm {
  title: string;
  description: string;
  client_id: string;
  deal_id?: string;
  issue_type: 'technical' | 'billing' | 'general' | 'complaint';
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface CreateChannelForm {
  name: string;
  type: '1_to_1' | 'group' | 'deal_context';
  deal_id?: string;
  members: string[];
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filter and Search Types
export interface FilterOptions {
  search?: string;
  status?: string;
  type?: string;
  expo_id?: string;
  client_id?: string;
  assigned_user_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}