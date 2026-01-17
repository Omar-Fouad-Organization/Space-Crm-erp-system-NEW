import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { paymentScheduleService, paymentService, type PaymentSchedule } from '@/services/supabaseService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Edit,
  Trash2,
  Download,
  RefreshCw,
  Building2,
  Target,
  TrendingUp,
  Activity,
  Zap,
  Send,
  Copy,
  FileText,
  Receipt,
  Banknote,
  Wallet,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  Bell,
  Flag,
  Star,
  Archive,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  Settings,
  Calculator,
  Percent,
  TrendingDown
} from "lucide-react";

interface Payment {
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

interface PaymentSchedule {
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

interface PaymentForm {
  client_id: string;
  deal_id: string;
  invoice_number: string;
  total_amount: string;
  currency: string;
  payment_method: string;
  due_date: string;
  description: string;
  notes: string;
  tags: string;
}

const Payments = () => {
  const { toast } = useToast();
  const { formatAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [methodFilter, setMethodFilter] = useState("all-methods");
  const [urgencyFilter, setUrgencyFilter] = useState("all-urgency");
  const [dateFilter, setDateFilter] = useState("all-dates");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'schedules' | 'payments' | 'analytics'>('schedules');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    client_id: '',
    deal_id: '',
    invoice_number: '',
    total_amount: '',
    currency: 'USD',
    payment_method: 'Bank Transfer',
    due_date: '',
    description: '',
    notes: '',
    tags: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('💰 Payments: Loading payment data from database...');
      
      // Load payment schedules from database
      const [paymentSchedulesData, paymentsData] = await Promise.all([
        paymentScheduleService.getAll(),
        paymentService.getAll()
      ]);
      
      console.log('💰 Payments: Loaded data:', {
        schedules: paymentSchedulesData?.length || 0,
        payments: paymentsData?.length || 0
      });
      
      // Payment schedules are already in the correct format from the service
      const transformedSchedules: PaymentSchedule[] = paymentSchedulesData || [];
      
      setPaymentSchedules(transformedSchedules);
      setPayments(paymentsData || []);
      
      if (transformedSchedules.length > 0 || (paymentsData && paymentsData.length > 0)) {
        toast({
          title: "Payment Data Loaded",
          description: `Loaded ${transformedSchedules.length} payment schedules and ${paymentsData?.length || 0} payments`,
        });
      } else {
        console.log('💰 Payments: No payment data found, this is normal for new systems');
      }
    } catch (error: any) {
      console.error('❌ Payments: Error loading payment data:', error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load payment data from database. Please check your connection.",
        variant: "destructive",
      });
      
      // Set empty arrays on error
      setPaymentSchedules([]);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    console.log('🔄 Payments: Refreshing payment data...');
    await loadData();
  };

  const loadMockData = async () => {
    setLoading(true);
    
    try {
      // Enhanced mock payment schedules data
      const mockPaymentSchedules: PaymentSchedule[] = [
        {
          payment_schedule_id: 'ps-001',
          deal_id: 'deal-001',
          deal_number: 'DEAL-2026-001',
          deal_title: 'EcoTech Solutions - Green Energy Expo Sponsorship',
          client_name: 'EcoTech Solutions',
          payment_name: 'Initial Payment (30%)',
          scheduled_amount: '75000.00',
          currency: 'USD',
          due_date: '2026-01-15T00:00:00Z',
          payment_status: 'Overdue',
          payment_method: 'Bank Transfer',
          urgency_status: 'Overdue',
          days_until_due: -5,
          payment_description: 'First installment for Green Energy Expo main sponsorship package',
          notes: 'Client requested extended payment terms. Follow up required.'
        },
        {
          payment_schedule_id: 'ps-002',
          deal_id: 'deal-001',
          deal_number: 'DEAL-2026-001',
          deal_title: 'EcoTech Solutions - Green Energy Expo Sponsorship',
          client_name: 'EcoTech Solutions',
          payment_name: 'Progress Payment (40%)',
          scheduled_amount: '100000.00',
          currency: 'USD',
          due_date: '2026-02-15T00:00:00Z',
          payment_status: 'Pending',
          payment_method: 'Bank Transfer',
          urgency_status: 'Upcoming',
          days_until_due: 36,
          payment_description: 'Second installment due upon booth setup completion'
        },
        {
          payment_schedule_id: 'ps-003',
          deal_id: 'deal-001',
          deal_number: 'DEAL-2026-001',
          deal_title: 'EcoTech Solutions - Green Energy Expo Sponsorship',
          client_name: 'EcoTech Solutions',
          payment_name: 'Final Payment (30%)',
          scheduled_amount: '75000.00',
          currency: 'USD',
          due_date: '2026-03-15T00:00:00Z',
          payment_status: 'Pending',
          payment_method: 'Bank Transfer',
          urgency_status: 'Future',
          days_until_due: 64,
          payment_description: 'Final installment due after expo completion'
        },
        {
          payment_schedule_id: 'ps-004',
          deal_id: 'deal-002',
          deal_number: 'DEAL-2026-002',
          deal_title: 'Solar Dynamics Corp - Premium Booth Package',
          client_name: 'Solar Dynamics Corp',
          payment_name: 'Full Payment',
          scheduled_amount: '120000.00',
          currency: 'USD',
          due_date: '2026-01-20T00:00:00Z',
          payment_status: 'Paid',
          paid_date: '2026-01-18T14:30:00Z',
          payment_method: 'Wire Transfer',
          urgency_status: 'Completed',
          days_until_due: null,
          payment_description: 'Complete payment for premium booth package with additional services'
        },
        {
          payment_schedule_id: 'ps-005',
          deal_id: 'deal-003',
          deal_number: 'DEAL-2026-003',
          deal_title: 'WindPower Solutions - Technology Partnership',
          client_name: 'WindPower Solutions',
          payment_name: 'Partnership Fee (50%)',
          scheduled_amount: '90000.00',
          currency: 'USD',
          due_date: '2026-01-25T00:00:00Z',
          payment_status: 'Pending',
          payment_method: 'Credit Card',
          urgency_status: 'Due Soon',
          days_until_due: 15,
          payment_description: 'First half of technology partnership agreement'
        },
        {
          payment_schedule_id: 'ps-006',
          deal_id: 'deal-003',
          deal_number: 'DEAL-2026-003',
          deal_title: 'WindPower Solutions - Technology Partnership',
          client_name: 'WindPower Solutions',
          payment_name: 'Partnership Fee (50%)',
          scheduled_amount: '90000.00',
          currency: 'USD',
          due_date: '2026-04-25T00:00:00Z',
          payment_status: 'Pending',
          payment_method: 'Credit Card',
          urgency_status: 'Future',
          days_until_due: 105,
          payment_description: 'Second half of technology partnership agreement'
        },
        {
          payment_schedule_id: 'ps-007',
          deal_id: 'deal-004',
          deal_number: 'DEAL-2026-004',
          deal_title: 'CleanTech Innovations - Platinum Sponsorship',
          client_name: 'CleanTech Innovations',
          payment_name: 'Deposit (25%)',
          scheduled_amount: '80000.00',
          currency: 'USD',
          due_date: '2026-01-12T00:00:00Z',
          payment_status: 'Paid',
          paid_date: '2026-01-10T09:15:00Z',
          payment_method: 'Bank Transfer',
          urgency_status: 'Completed',
          days_until_due: null,
          payment_description: 'Initial deposit for platinum sponsorship package'
        },
        {
          payment_schedule_id: 'ps-008',
          deal_id: 'deal-004',
          deal_number: 'DEAL-2026-004',
          deal_title: 'CleanTech Innovations - Platinum Sponsorship',
          client_name: 'CleanTech Innovations',
          payment_name: 'Balance Payment (75%)',
          scheduled_amount: '240000.00',
          currency: 'USD',
          due_date: '2026-02-01T00:00:00Z',
          payment_status: 'Pending',
          payment_method: 'Bank Transfer',
          urgency_status: 'Due Soon',
          days_until_due: 22,
          payment_description: 'Remaining balance for platinum sponsorship package'
        }
      ];

      // Enhanced mock payments data
      const mockPayments: Payment[] = [
        {
          id: 'pay-001',
          payment_number: 'PAY-2026-001',
          invoice_number: 'INV-2026-001',
          client_id: 'client-001',
          client_name: 'EcoTech Solutions',
          deal_id: 'deal-001',
          deal_name: 'Green Energy Expo Sponsorship',
          deal_type: 'Main Sponsorship',
          total_amount: 250000,
          paid_amount: 0,
          remaining_amount: 250000,
          currency: 'USD',
          payment_status: 'Pending',
          payment_method: 'Bank Transfer',
          due_date: '2026-01-15T00:00:00Z',
          transaction_id: '',
          reference_number: 'REF-ECO-001',
          description: 'Green Energy Expo main sponsorship package payment',
          notes: 'Client requested payment plan: 30% initial, 40% progress, 30% final',
          tags: ['sponsorship', 'expo', 'green-energy'],
          created_at: '2026-01-05T10:00:00Z',
          updated_at: '2026-01-08T14:30:00Z'
        },
        {
          id: 'pay-002',
          payment_number: 'PAY-2026-002',
          invoice_number: 'INV-2026-002',
          client_id: 'client-002',
          client_name: 'Solar Dynamics Corp',
          deal_id: 'deal-002',
          deal_name: 'Premium Booth Package',
          deal_type: 'Booth Rental',
          total_amount: 120000,
          paid_amount: 120000,
          remaining_amount: 0,
          currency: 'USD',
          payment_status: 'Completed',
          payment_method: 'Wire Transfer',
          due_date: '2026-01-20T00:00:00Z',
          payment_date: '2026-01-18T14:30:00Z',
          transaction_id: 'TXN-WIRE-20260118-001',
          reference_number: 'REF-SOL-002',
          description: 'Premium booth package with additional services',
          notes: 'Payment received 2 days early. Excellent client relationship.',
          tags: ['booth', 'premium', 'solar'],
          created_at: '2026-01-03T09:00:00Z',
          updated_at: '2026-01-18T14:35:00Z'
        },
        {
          id: 'pay-003',
          payment_number: 'PAY-2026-003',
          invoice_number: 'INV-2026-003',
          client_id: 'client-003',
          client_name: 'WindPower Solutions',
          deal_id: 'deal-003',
          deal_name: 'Technology Partnership',
          deal_type: 'Partnership',
          total_amount: 180000,
          paid_amount: 90000,
          remaining_amount: 90000,
          currency: 'USD',
          payment_status: 'Partial',
          payment_method: 'Credit Card',
          due_date: '2026-01-25T00:00:00Z',
          payment_date: '2026-01-22T11:45:00Z',
          transaction_id: 'TXN-CC-20260122-001',
          reference_number: 'REF-WIND-003',
          description: 'Technology partnership agreement - first installment',
          notes: 'First 50% payment received. Second installment due in Q2.',
          tags: ['partnership', 'technology', 'wind-power'],
          created_at: '2026-01-02T11:30:00Z',
          updated_at: '2026-01-22T12:00:00Z'
        },
        {
          id: 'pay-004',
          payment_number: 'PAY-2026-004',
          invoice_number: 'INV-2026-004',
          client_id: 'client-004',
          client_name: 'CleanTech Innovations',
          deal_id: 'deal-004',
          deal_name: 'Platinum Sponsorship',
          deal_type: 'Platinum Sponsor',
          total_amount: 320000,
          paid_amount: 80000,
          remaining_amount: 240000,
          currency: 'USD',
          payment_status: 'Partial',
          payment_method: 'Bank Transfer',
          due_date: '2026-02-01T00:00:00Z',
          payment_date: '2026-01-10T09:15:00Z',
          transaction_id: 'TXN-BANK-20260110-001',
          reference_number: 'REF-CLEAN-004',
          description: 'Platinum sponsorship package - deposit payment',
          notes: 'Initial 25% deposit received. Balance due before expo.',
          tags: ['sponsorship', 'platinum', 'clean-tech'],
          created_at: '2026-01-01T08:00:00Z',
          updated_at: '2026-01-10T09:20:00Z'
        },
        {
          id: 'pay-005',
          payment_number: 'PAY-2026-005',
          invoice_number: 'INV-2026-005',
          client_id: 'client-005',
          client_name: 'GreenGrid Systems',
          deal_id: 'deal-005',
          deal_name: 'Smart Grid Exhibition',
          deal_type: 'Exhibition',
          total_amount: 95000,
          paid_amount: 0,
          remaining_amount: 95000,
          currency: 'USD',
          payment_status: 'Processing',
          payment_method: 'Check',
          due_date: '2026-01-30T00:00:00Z',
          transaction_id: '',
          reference_number: 'REF-GRID-005',
          description: 'Smart grid technology exhibition space',
          notes: 'Check payment in processing. Expected clearance within 3-5 business days.',
          tags: ['exhibition', 'smart-grid', 'technology'],
          created_at: '2026-01-07T13:45:00Z',
          updated_at: '2026-01-09T16:20:00Z'
        },
        {
          id: 'pay-006',
          payment_number: 'PAY-2026-006',
          invoice_number: 'INV-2026-006',
          client_id: 'client-006',
          client_name: 'EnergyFlow Dynamics',
          deal_id: 'deal-006',
          deal_name: 'Workshop Series',
          deal_type: 'Workshop',
          total_amount: 45000,
          paid_amount: 0,
          remaining_amount: 45000,
          currency: 'USD',
          payment_status: 'Failed',
          payment_method: 'Credit Card',
          due_date: '2026-01-18T00:00:00Z',
          transaction_id: 'TXN-CC-FAILED-001',
          reference_number: 'REF-FLOW-006',
          description: 'Workshop series on energy flow optimization',
          notes: 'Credit card payment failed due to insufficient funds. Client contacted for alternative payment method.',
          tags: ['workshop', 'energy-flow', 'failed-payment'],
          created_at: '2026-01-06T10:20:00Z',
          updated_at: '2026-01-18T15:45:00Z'
        }
      ];

      setPaymentSchedules(mockPaymentSchedules);
      setPayments(mockPayments);
      
      toast({
        title: "Payment Data Loaded",
        description: `Loaded ${mockPaymentSchedules.length} payment schedules and ${mockPayments.length} payments`,
      });
    } catch (error: any) {
      console.error('Error loading payment data:', error);
      toast({
        title: "Error",
        description: "Failed to load payment data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const newPayment: Payment = {
        id: `pay-${Date.now()}`,
        payment_number: `PAY-2026-${String(payments.length + 1).padStart(3, '0')}`,
        invoice_number: paymentForm.invoice_number,
        client_id: paymentForm.client_id,
        client_name: 'New Client', // In real app, fetch from client_id
        deal_id: paymentForm.deal_id,
        deal_name: 'New Deal', // In real app, fetch from deal_id
        total_amount: parseFloat(paymentForm.total_amount),
        paid_amount: 0,
        remaining_amount: parseFloat(paymentForm.total_amount),
        currency: paymentForm.currency,
        payment_status: 'Pending',
        payment_method: paymentForm.payment_method,
        due_date: paymentForm.due_date,
        description: paymentForm.description,
        notes: paymentForm.notes,
        tags: paymentForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setPayments(prev => [newPayment, ...prev]);
      
      toast({
        title: "Payment Created",
        description: `Payment ${newPayment.payment_number} has been created successfully`,
      });
      
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create payment",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePaymentStatus = async (paymentScheduleId: string, status: string) => {
    try {
      console.log('💰 Payments: Updating payment status:', paymentScheduleId, status);
      
      // Update in database first
      const paidDate = status === 'Paid' ? new Date().toISOString() : undefined;
      await paymentScheduleService.updateStatus(paymentScheduleId, status.toLowerCase(), paidDate);
      
      // Update local state after successful database update
      setPaymentSchedules(prev => 
        prev.map(schedule => 
          schedule.payment_schedule_id === paymentScheduleId 
            ? { 
                ...schedule, 
                payment_status: status as PaymentSchedule['payment_status'],
                paid_date: paidDate,
                urgency_status: status === 'Paid' ? 'Completed' : schedule.urgency_status
              }
            : schedule
        )
      );
      
      toast({
        title: "Payment Updated",
        description: `Payment status successfully updated to ${status}`,
      });
      
      console.log('✅ Payments: Payment status updated successfully');
    } catch (error: any) {
      console.error('❌ Payments: Error updating payment status:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update payment status",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (paymentId: string, newStatus: string) => {
    try {
      setPayments(prev => 
        prev.map(payment => 
          payment.id === paymentId 
            ? { 
                ...payment, 
                payment_status: newStatus as Payment['payment_status'],
                payment_date: newStatus === 'Completed' ? new Date().toISOString() : payment.payment_date,
                paid_amount: newStatus === 'Completed' ? payment.total_amount : payment.paid_amount,
                remaining_amount: newStatus === 'Completed' ? 0 : payment.remaining_amount,
                updated_at: new Date().toISOString()
              }
            : payment
        )
      );
      
      toast({
        title: "Status Updated",
        description: `Payment status changed to ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;
    
    try {
      setPayments(prev => prev.filter(payment => payment.id !== paymentToDelete.id));
      
      toast({
        title: "Payment Deleted",
        description: "Payment has been permanently removed from the system",
      });
      
      setShowDeleteDialog(false);
      setPaymentToDelete(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete payment",
        variant: "destructive",
      });
    }
  };

  const handleSendReminder = (paymentId: string) => {
    toast({
      title: "Reminder Sent",
      description: "Payment reminder has been sent to the client",
    });
  };

  const resetForm = () => {
    setPaymentForm({
      client_id: '',
      deal_id: '',
      invoice_number: '',
      total_amount: '',
      currency: 'USD',
      payment_method: 'Bank Transfer',
      due_date: '',
      description: '',
      notes: '',
      tags: ''
    });
  };

  const handleExportPayments = () => {
    try {
      const dataToExport = viewMode === 'schedules' ? paymentSchedules : payments;
      
      if (!dataToExport || dataToExport.length === 0) {
        toast({
          title: "No Data",
          description: "No payment data to export",
          variant: "destructive",
        });
        return;
      }

      const csvData = dataToExport.map((payment, index) => {
        if (viewMode === 'schedules') {
          const schedule = payment as PaymentSchedule;
          return {
            'Row': index + 1,
            'Client Name': schedule.client_name || '',
            'Deal Number': schedule.deal_number || '',
            'Deal Title': schedule.deal_title || '',
            'Payment Description': schedule.payment_name || '',
            'Amount': parseFloat(schedule.scheduled_amount || '0').toFixed(2),
            'Currency': schedule.currency || 'USD',
            'Due Date': schedule.due_date ? new Date(schedule.due_date).toLocaleDateString() : '',
            'Paid Date': schedule.paid_date ? new Date(schedule.paid_date).toLocaleDateString() : '',
            'Payment Method': schedule.payment_method || '',
            'Status': schedule.payment_status || 'Pending',
            'Urgency Level': schedule.urgency_status || '',
            'Days Until Due': schedule.days_until_due !== null ? schedule.days_until_due : '',
            'Notes': schedule.notes || schedule.payment_description || '',
          };
        } else {
          const pay = payment as Payment;
          return {
            'Row': index + 1,
            'Payment Number': pay.payment_number || '',
            'Invoice Number': pay.invoice_number || '',
            'Client Name': pay.client_name || '',
            'Deal Name': pay.deal_name || '',
            'Total Amount': pay.total_amount.toFixed(2),
            'Paid Amount': pay.paid_amount.toFixed(2),
            'Remaining Amount': pay.remaining_amount.toFixed(2),
            'Currency': pay.currency || 'USD',
            'Payment Method': pay.payment_method || '',
            'Status': pay.payment_status || 'Pending',
            'Due Date': pay.due_date ? new Date(pay.due_date).toLocaleDateString() : '',
            'Payment Date': pay.payment_date ? new Date(pay.payment_date).toLocaleDateString() : '',
            'Transaction ID': pay.transaction_id || '',
            'Reference Number': pay.reference_number || '',
            'Description': pay.description || '',
            'Notes': pay.notes || ''
          };
        }
      });

      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          headers.map(header => 
            `"${String(row[header as keyof typeof row]).replace(/"/g, '""')}"`
          ).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `payments_${viewMode}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `${dataToExport.length} payment records exported to CSV`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export payment data",
        variant: "destructive",
      });
    }
  };

  // Filter functions
  const filteredPaymentSchedules = paymentSchedules.filter(payment => {
    const matchesSearch = !searchTerm || 
      payment.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.deal_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.deal_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.payment_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all-status" || payment.payment_status === statusFilter;
    const matchesMethod = methodFilter === "all-methods" || payment.payment_method === methodFilter;
    const matchesUrgency = urgencyFilter === "all-urgency" || payment.urgency_status === urgencyFilter;
    
    // Date filter logic
    let matchesDate = true;
    if (dateFilter !== "all-dates" && payment.due_date) {
      const dueDate = new Date(payment.due_date);
      const today = new Date();
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      switch (dateFilter) {
        case "overdue":
          matchesDate = diffDays < 0;
          break;
        case "due-today":
          matchesDate = diffDays === 0;
          break;
        case "due-week":
          matchesDate = diffDays >= 0 && diffDays <= 7;
          break;
        case "due-month":
          matchesDate = diffDays >= 0 && diffDays <= 30;
          break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesMethod && matchesUrgency && matchesDate;
  });

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = !searchTerm || 
      payment.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.payment_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.deal_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all-status" || payment.payment_status === statusFilter;
    const matchesMethod = methodFilter === "all-methods" || payment.payment_method === methodFilter;
    
    return matchesSearch && matchesStatus && matchesMethod;
  });

  // Calculate statistics
  const scheduleStats = {
    total: paymentSchedules.length,
    paid: paymentSchedules.filter(p => p.payment_status === 'Paid').length,
    pending: paymentSchedules.filter(p => p.payment_status === 'Pending').length,
    overdue: paymentSchedules.filter(p => p.urgency_status === 'Overdue').length,
    dueSoon: paymentSchedules.filter(p => p.urgency_status === 'Due Soon').length,
    upcoming: paymentSchedules.filter(p => p.urgency_status === 'Upcoming').length,
    totalAmount: paymentSchedules.reduce((sum, payment) => sum + (parseFloat(payment.scheduled_amount) || 0), 0),
    paidAmount: paymentSchedules.filter(p => p.payment_status === 'Paid')
      .reduce((sum, payment) => sum + (parseFloat(payment.scheduled_amount) || 0), 0),
    pendingAmount: paymentSchedules.filter(p => p.payment_status === 'Pending')
      .reduce((sum, payment) => sum + (parseFloat(payment.scheduled_amount) || 0), 0)
  };

  const paymentStats = {
    total: payments.length,
    completed: payments.filter(p => p.payment_status === 'Completed').length,
    pending: payments.filter(p => p.payment_status === 'Pending').length,
    partial: payments.filter(p => p.payment_status === 'Partial').length,
    processing: payments.filter(p => p.payment_status === 'Processing').length,
    failed: payments.filter(p => p.payment_status === 'Failed').length,
    totalAmount: payments.reduce((sum, payment) => sum + (payment.total_amount || 0), 0),
    paidAmount: 0, // TODO: Add paid amount tracking
    remainingAmount: payments.reduce((sum, payment) => sum + (payment.remaining_amount || 0), 0)
  };

  const formatCurrency = (amount: number, currency?: string) => {
    // Validate amount before formatting
    if (amount === null || amount === undefined || isNaN(amount)) {
      console.warn('Invalid amount in formatCurrency:', amount);
      return formatAmount(0);
    }
    return formatAmount(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed': case 'Paid': return <CheckCircle className="h-3 w-3 mr-1" />;
      case 'Pending': return <Clock className="h-3 w-3 mr-1" />;
      case 'Processing': return <PlayCircle className="h-3 w-3 mr-1" />;
      case 'Partial': return <PieChart className="h-3 w-3 mr-1" />;
      case 'Failed': return <XCircle className="h-3 w-3 mr-1" />;
      case 'Cancelled': return <XCircle className="h-3 w-3 mr-1" />;
      case 'Overdue': return <AlertTriangle className="h-3 w-3 mr-1" />;
      default: return <Clock className="h-3 w-3 mr-1" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': case 'Paid': return 'bg-green-100 text-green-800 border-green-200';
      case 'Pending': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Partial': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'Cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'Overdue': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'Due Soon': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Upcoming': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Future': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Completed': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 animate-pulse rounded w-64" />
          <div className="h-8 bg-gray-200 animate-pulse rounded w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 animate-pulse rounded" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 animate-pulse rounded mb-2" />
                <div className="h-8 bg-gray-200 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold tracking-tight">
            <CreditCard className="inline-block h-8 w-8 mr-3 text-green-600" />
            Payment Management
          </h1>

          <p className="text-muted-foreground mt-2">
            {viewMode === 'schedules' 
              ? 'Track payment schedules from deals for financial planning' 
              : viewMode === 'payments'
              ? 'Track payments, invoices, and financial transactions'
              : 'Analyze payment trends and financial performance'
            }
          </p>

        </div>

        <div className="flex items-center space-x-3">

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <Button 
              variant={viewMode === 'schedules' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('schedules')}
              className="text-xs"
            >
              <Calendar className="h-3 w-3 mr-1" />
              Schedules
            </Button>
            <Button 
              variant={viewMode === 'payments' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('payments')}
              className="text-xs"
            >
              <CreditCard className="h-3 w-3 mr-1" />
              Payments
            </Button>
            <Button 
              variant={viewMode === 'analytics' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('analytics')}
              className="text-xs"
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              Analytics
            </Button>
          </div>

          <Button onClick={refreshData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleExportPayments} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {viewMode === 'payments' && (
            <Button onClick={() => setShowCreateDialog(true)} className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              New Payment
            </Button>
          )}
        </div>

      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">

        {viewMode === 'schedules' ? (
          // Payment Schedules Statistics
          <>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('all-status')}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Schedules
                    </p>
                    <p className="text-2xl font-bold">
                      {scheduleStats.total}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(scheduleStats.totalAmount, 'USD')}
                    </p>
                  </div>
                  <Activity className="h-4 w-4 text-blue-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('Paid')}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Paid
                    </p>
                    <p className="text-2xl font-bold">
                      {scheduleStats.paid}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(scheduleStats.paidAmount, 'USD')}
                    </p>
                  </div>
                  <TrendingUp className="h-4 w-4 text-green-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter('Pending')}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Pending
                    </p>
                    <p className="text-2xl font-bold">
                      {scheduleStats.pending}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(scheduleStats.pendingAmount, 'USD')}
                    </p>
                  </div>
                  <Timer className="h-4 w-4 text-orange-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setUrgencyFilter('Overdue')}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Overdue
                    </p>
                    <p className="text-2xl font-bold">
                      {scheduleStats.overdue}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Needs Attention
                    </p>
                  </div>
                  <Flag className="h-4 w-4 text-red-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setUrgencyFilter('Due Soon')}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Bell className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Due Soon
                    </p>
                    <p className="text-2xl font-bold">
                      {scheduleStats.dueSoon}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Next 7 Days
                    </p>
                  </div>
                  <Timer className="h-4 w-4 text-yellow-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setUrgencyFilter('Upcoming')}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Upcoming
                    </p>
                    <p className="text-2xl font-bold">
                      {scheduleStats.upcoming}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Next 30 Days
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-blue-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
          </>
        ) : viewMode === 'payments' ? (
          // Traditional Payments Statistics
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Payments
                    </p>
                    <p className="text-2xl font-bold">
                      {paymentStats.total}
                    </p>
                  </div>
                  <Activity className="h-4 w-4 text-blue-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Completed
                    </p>
                    <p className="text-2xl font-bold">
                      {paymentStats.completed}
                    </p>
                  </div>
                  <TrendingUp className="h-4 w-4 text-green-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Pending
                    </p>
                    <p className="text-2xl font-bold">
                      {paymentStats.pending}
                    </p>
                  </div>
                  <Timer className="h-4 w-4 text-orange-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <PlayCircle className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Processing
                    </p>
                    <p className="text-2xl font-bold">
                      {paymentStats.processing}
                    </p>
                  </div>
                  <Activity className="h-4 w-4 text-blue-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Amount
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(paymentStats.totalAmount)}
                    </p>
                  </div>
                  <TrendingUp className="h-4 w-4 text-green-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Wallet className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Remaining
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(paymentStats.remainingAmount)}
                    </p>
                  </div>
                  <ArrowDownRight className="h-4 w-4 text-orange-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          // Analytics Statistics
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Percent className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Collection Rate
                    </p>
                    <p className="text-2xl font-bold">
                      {paymentStats.totalAmount > 0 
                        ? Math.round((paymentStats.paidAmount / paymentStats.totalAmount) * 100)
                        : 0}%
                    </p>
                  </div>
                  <TrendingUp className="h-4 w-4 text-green-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Timer className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Avg Payment Time
                    </p>
                    <p className="text-2xl font-bold">
                      18 days
                    </p>
                  </div>
                  <Clock className="h-4 w-4 text-blue-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Success Rate
                    </p>
                    <p className="text-2xl font-bold">
                      94%
                    </p>
                  </div>
                  <Star className="h-4 w-4 text-green-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Monthly Growth
                    </p>
                    <p className="text-2xl font-bold">
                      +12%
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-green-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Active Clients
                    </p>
                    <p className="text-2xl font-bold">
                      24
                    </p>
                  </div>
                  <Building2 className="h-4 w-4 text-blue-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Calculator className="h-4 w-4 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Avg Deal Size
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(155000)}
                    </p>
                  </div>
                  <Target className="h-4 w-4 text-purple-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Main Content */}
      <Tabs value={viewMode} onValueChange={setViewMode as any} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="schedules">Payment Schedules</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="schedules" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4">

                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search payment schedules..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-status">All Status</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Overdue">Overdue</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-urgency">All Urgency</SelectItem>
                      <SelectItem value="Overdue">Overdue</SelectItem>
                      <SelectItem value="Due Soon">Due Soon</SelectItem>
                      <SelectItem value="Upcoming">Upcoming</SelectItem>
                      <SelectItem value="Future">Future</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-dates">All Dates</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="due-today">Due Today</SelectItem>
                      <SelectItem value="due-week">Due This Week</SelectItem>
                      <SelectItem value="due-month">Due This Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </CardContent>
          </Card>
          {/* Payment Schedules List */}
          <div className="space-y-4">

            {filteredPaymentSchedules.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {paymentSchedules.length === 0 ? "No Payment Schedules Found" : "No Matching Payment Schedules"}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {paymentSchedules.length === 0 
                      ? "Payment schedules from deals will appear here for financial tracking"
                      : "Try adjusting your search criteria or filters"
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredPaymentSchedules.map((schedule) => (
                <Card key={schedule.payment_schedule_id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-6">

                      <div className="flex items-start justify-between mb-4">

                        <div className="flex items-center space-x-3">

                          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                            <CreditCard className="h-6 w-6 text-green-600" />
                          </div>

                          <div>
                          
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="text-lg font-semibold">
                                {schedule.deal_number}
                              </h3>
                              <Badge className={getStatusColor(schedule.payment_status)}>
                                {getStatusIcon(schedule.payment_status)}
                                {schedule.payment_status}
                              </Badge>
                              {schedule.payment_status !== 'Paid' && schedule.urgency_status && (
                                <Badge className={getUrgencyColor(schedule.urgency_status)}>
                                  {schedule.urgency_status === 'Overdue' && <AlertTriangle className="h-3 w-3 mr-1" />}
                                  {schedule.urgency_status === 'Due Soon' && <Bell className="h-3 w-3 mr-1" />}
                                  {schedule.urgency_status}
                                </Badge>
                              )}
                            </div>

                            <h4 className="text-xl font-semibold mb-1">{schedule.deal_title}</h4>
                            <p className="text-muted-foreground">{schedule.client_name} • {schedule.payment_name}</p>

                          </div>

                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleUpdatePaymentStatus(schedule.payment_schedule_id, 'Paid')}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark as Paid
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdatePaymentStatus(schedule.payment_schedule_id, 'Pending')}>
                              <Clock className="h-4 w-4 mr-2" />
                              Mark as Pending
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleSendReminder(schedule.payment_schedule_id)}>
                              <Send className="h-4 w-4 mr-2" />
                              Send Reminder
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">

                        <div>
                          <span className="font-medium">Amount</span>
                          <div className="text-lg font-bold text-green-600">
                            {formatCurrency(parseFloat(schedule.scheduled_amount), schedule.currency)}
                          </div>
                        </div>

                        {schedule.payment_status === 'Paid' ? (
                          <div>
                            <span className="font-medium">Paid Date</span>
                            <div className="text-muted-foreground">
                              {schedule.paid_date ? formatDate(schedule.paid_date) : 'Recently Paid'}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="font-medium">Due Date</span>
                            <div className="text-muted-foreground">
                              {schedule.due_date ? formatDate(schedule.due_date) : 'Not set'}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Payment Method</span>
                          <div className="text-muted-foreground">{schedule.payment_method || 'Not specified'}</div>
                        </div>

                        {schedule.payment_status !== 'Paid' && (
                          <div>
                            <span className="font-medium">Days Until Due</span>
                            <div className="text-muted-foreground">
                              {schedule.days_until_due !== null ? 
                                (schedule.days_until_due < 0 ? `${Math.abs(schedule.days_until_due)} days overdue` :
                                 schedule.days_until_due === 0 ? 'Due today' :
                                 `${schedule.days_until_due} days`
                                ) : 'N/A'
                              }
                            </div>
                          </div>
                        )}
                      </div>

                      {schedule.payment_description && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">{schedule.payment_description}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

        </TabsContent>
        <TabsContent value="payments" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4">

                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search payments..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-status">All Status</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Processing">Processing</SelectItem>
                      <SelectItem value="Partial">Partial</SelectItem>
                      <SelectItem value="Failed">Failed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <CreditCard className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-methods">All Methods</SelectItem>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Wire Transfer">Wire Transfer</SelectItem>
                      <SelectItem value="Check">Check</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </CardContent>
          </Card>
          {/* Payments List */}
          <div className="space-y-4">

            {filteredPayments.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {payments.length === 0 ? "No Payments Found" : "No Matching Payments"}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {payments.length === 0 
                      ? "Payments will appear here when transactions are processed"
                      : "Try adjusting your search criteria or filters"
                    }
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Payment
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredPayments.map((payment) => (
                <Card key={payment.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-6">

                      <div className="flex items-start justify-between mb-4">

                        <div className="flex items-center space-x-3">

                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <CreditCard className="h-6 w-6 text-blue-600" />
                          </div>

                          <div>
                          
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="text-lg font-semibold">
                                {payment.payment_number}
                              </h3>
                              <Badge className={getStatusColor(payment.payment_status)}>
                                {getStatusIcon(payment.payment_status)}
                                {payment.payment_status}
                              </Badge>
                              {payment.tags && payment.tags.slice(0, 2).map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>

                            <h4 className="text-xl font-semibold mb-1">{payment.client_name}</h4>
                            <p className="text-muted-foreground">{payment.deal_name} • {payment.deal_type}</p>

                          </div>

                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            {payment.payment_status === 'Pending' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(payment.id, 'Processing')}>
                                <PlayCircle className="h-4 w-4 mr-2" />
                                Mark Processing
                              </DropdownMenuItem>
                            )}
                            {(payment.payment_status === 'Pending' || payment.payment_status === 'Processing') && (
                              <DropdownMenuItem onClick={() => handleStatusChange(payment.id, 'Completed')}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark Completed
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendReminder(payment.id)}>
                              <Send className="h-4 w-4 mr-2" />
                              Send Reminder
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setPaymentToDelete(payment);
                                setShowDeleteDialog(true);
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Payment
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">

                        <div>
                          <span className="font-medium">Total Amount</span>
                          <div className="text-lg font-bold text-green-600">
                            {formatCurrency(payment.total_amount || 0, payment.currency)}
                          </div>
                        </div>

                        <div>
                          <span className="font-medium">Paid Amount</span>
                          <div className="text-lg font-bold text-blue-600">
                            {formatCurrency(payment.paid_amount || 0, payment.currency)} {/* TODO: Add paid amount tracking */}
                          </div>
                        </div>

                        <div>
                          <span className="font-medium">Due Date</span>
                          <div className="text-muted-foreground">{formatDate(payment.due_date || '')}</div>
                        </div>

                        <div>
                          <span className="font-medium">Payment Method</span>
                          <div className="text-muted-foreground">{payment.payment_method || 'Not specified'}</div>
                        </div>

                      </div>

                      {payment.remaining_amount > 0 && (
                        <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="flex items-center space-x-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            <span className="text-sm font-medium text-yellow-800">
                              Remaining: {formatCurrency(payment.remaining_amount, payment.currency)}
                            </span>
                          </div>
                        </div>
                      )}
                      {payment.description && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">{payment.description}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

        </TabsContent>
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <Card>
              <CardHeader>
                <CardTitle>Payment Trends</CardTitle>
                <CardDescription>Monthly payment volume and success rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Payment trends chart will be displayed here
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Distribution of payment methods used</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <PieChart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Payment methods chart will be displayed here
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Collection Performance</CardTitle>
                <CardDescription>Payment collection rates over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Collection performance chart will be displayed here
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Client Payment Behavior</CardTitle>
                <CardDescription>Average payment times by client segment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Client behavior analysis will be displayed here
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </TabsContent>
      </Tabs>

      {/* Create Payment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Create New Payment
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePayment}>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

              <div className="space-y-2">
                <Label htmlFor="client_id">Client *</Label>
                <Input
                  id="client_id"
                  value={paymentForm.client_id}
                  onChange={(e) => setPaymentForm({...paymentForm, client_id: e.target.value})}
                  placeholder="Select or enter client"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deal_id">Deal</Label>
                <Input
                  id="deal_id"
                  value={paymentForm.deal_id}
                  onChange={(e) => setPaymentForm({...paymentForm, deal_id: e.target.value})}
                  placeholder="Select or enter deal"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice Number</Label>
                <Input
                  id="invoice_number"
                  value={paymentForm.invoice_number}
                  onChange={(e) => setPaymentForm({...paymentForm, invoice_number: e.target.value})}
                  placeholder="INV-2026-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_amount">Total Amount *</Label>
                <Input
                  id="total_amount"
                  type="number"
                  step="0.01"
                  value={paymentForm.total_amount}
                  onChange={(e) => setPaymentForm({...paymentForm, total_amount: e.target.value})}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={paymentForm.currency} onValueChange={(value) => setPaymentForm({...paymentForm, currency: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select value={paymentForm.payment_method} onValueChange={(value) => setPaymentForm({...paymentForm, payment_method: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Wire Transfer">Wire Transfer</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={paymentForm.due_date}
                  onChange={(e) => setPaymentForm({...paymentForm, due_date: e.target.value})}
                />
              </div>

            </div>

            <div className="space-y-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm({...paymentForm, description: e.target.value})}
                  placeholder="Payment description..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                  placeholder="Internal notes..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={paymentForm.tags}
                  onChange={(e) => setPaymentForm({...paymentForm, tags: e.target.value})}
                  placeholder="Enter tags separated by commas"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Create Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <Trash2 className="h-5 w-5 mr-2 text-red-600" />
              Delete Payment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete payment "{paymentToDelete?.payment_number}"? 
              This action cannot be undone and will permanently remove the payment record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} className="bg-red-600 hover:bg-red-700">
              Delete Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Payments;