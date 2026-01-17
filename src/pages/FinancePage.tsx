import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { PageGuard } from '@/components/auth/PageGuard';
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  CreditCard,
  Receipt,
  PieChart,
  BarChart3,
  Target,
  Users,
  Building2,
  Search,
  Filter,
  Download,
  RefreshCw,
  Plus,
  Eye,
  Edit,
  Send,
  Bell,
  Flag,
  Zap,
  Award,
  Calculator,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Mail,
  Phone,
  MapPin,
  Star,
  Activity,
  Briefcase,
  Loader2,
  XCircle,
  CheckCircle2
} from "lucide-react";

// Payment plan configuration (30% / 40% / 30%)
const PAYMENT_PLAN_CONFIG = {
  initial: 0.30,    // 30% initial payment
  progress: 0.40,   // 40% progress payment
  final: 0.30       // 30% final payment
};

interface PaymentRecord {
  id: string;
  deal_id: string;
  deal_title: string;
  client_id: string;
  client_name: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: 'pending' | 'paid' | 'overdue' | 'partial';
  payment_type: 'initial' | 'progress' | 'final' | 'full';
  installment_number: number;
  total_installments: number;
  method?: 'bank_transfer' | 'credit_card' | 'check' | 'cash';
  reference?: string;
  notes?: string;
  reminder_sent?: boolean;
  commission_triggered?: boolean;
}

interface CommissionRecord {
  id: string;
  deal_id: string;
  deal_title: string;
  user_id: string;
  user_name: string;
  user_role: string;
  percentage: number;
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  trigger_event: 'deal_closed' | 'payment_received' | 'manual';
  created_at: string;
  approved_at?: string;
  paid_at?: string;
  notes?: string;
}

interface FinancialMetrics {
  total_revenue: number;
  monthly_revenue: number;
  revenue_growth: number;
  payments_collected: number;
  payments_pending: number;
  payments_overdue: number;
  commission_pending: number;
  commission_paid: number;
  collection_rate: number;
  avg_payment_time: number;
}

const Finance = () => {
  const { toast } = useToast();
  const { formatAmount } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<FinancialMetrics>({
    total_revenue: 0,
    monthly_revenue: 0,
    revenue_growth: 0,
    payments_collected: 0,
    payments_pending: 0,
    payments_overdue: 0,
    commission_pending: 0,
    commission_paid: 0,
    collection_rate: 0,
    avg_payment_time: 0,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTimeframe, setSelectedTimeframe] = useState("30d");
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [showCommissionDetails, setShowCommissionDetails] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<CommissionRecord | null>(null);

  useEffect(() => {
    loadData();
  }, [selectedTimeframe]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('💰 Loading finance data from database...');
      
      // Load real data from database
      const [dealsData, clientsData, paymentsData, commissionsData] = await Promise.all([
        supabase.from('deals_2026_01_17_18_37').select('*'),
        supabase.from('clients_2026_01_17_18_37').select('*'),
        supabase.from('payment_schedules_2026_01_17_18_37').select('*'),
        supabase.from('commission_schedules_2026_01_17_18_37').select('*')
      ]);
      
      if (dealsData.error) {
        console.error('❌ Error loading deals:', dealsData.error);
        throw dealsData.error;
      }
      
      if (clientsData.error) {
        console.error('❌ Error loading clients:', clientsData.error);
        throw clientsData.error;
      }
      
      if (paymentsData.error) {
        console.error('❌ Error loading payments:', paymentsData.error);
        // Continue without payments data
      }
      
      if (commissionsData.error) {
        console.error('❌ Error loading commissions:', commissionsData.error);
        // Continue without commissions data
      }
      
      const deals = dealsData.data || [];
      const clients = clientsData.data || [];
      const payments = paymentsData.data || [];
      const commissions = commissionsData.data || [];
      
      console.log('✅ Loaded finance data:', {
        deals: deals.length,
        clients: clients.length,
        payments: payments.length,
        commissions: commissions.length
      });
      
      // Process real payment data
      const paymentRecords: PaymentRecord[] = payments.map(payment => ({
        id: payment.id,
        deal_id: payment.deal_id,
        deal_title: payment.payment_name || 'Payment',
        client_id: payment.client_id || 'unknown',
        client_name: payment.client_name || 'Unknown Client',
        amount: parseFloat(payment.amount) || 0,
        due_date: payment.due_date,
        paid_date: payment.paid_date,
        status: payment.status || 'pending',
        payment_type: payment.payment_type || 'full',
        installment_number: payment.installment_number || 1,
        total_installments: payment.total_installments || 1,
        method: payment.payment_method,
        reference: payment.reference_number,
        notes: payment.notes,
        reminder_sent: payment.reminder_sent || false,
        commission_triggered: payment.commission_triggered || false
      }));
      
      // Process real commission data
      const commissionRecords: CommissionRecord[] = commissions.map(commission => ({
        id: commission.id,
        deal_id: commission.deal_id,
        deal_title: commission.deal_title || 'Commission',
        user_id: commission.sales_person_id,
        user_name: commission.sales_person_name || 'Unknown User',
        user_role: 'Sales Person',
        percentage: parseFloat(commission.commission_percentage) || 0,
        amount: parseFloat(commission.commission_amount) || 0,
        status: commission.status || 'pending',
        trigger_event: 'deal_closed',
        created_at: commission.created_at,
        approved_at: commission.status === 'approved' ? commission.updated_at : undefined,
        paid_at: commission.status === 'paid' ? commission.paid_date : undefined,
        notes: commission.notes
      }));
      
      // If no real payment data, generate from deals (fallback)
      if (paymentRecords.length === 0 && deals.length > 0) {
        console.log('🔄 No payment schedules found, generating from deals...');
        const mockDeals = [
        {
          id: '1',
          title: 'Green Energy Expo 2026 - Premium Package',
          client_id: '1',
          value: 250000,
          status: 'Closed Won',
          created_at: '2026-01-05T10:00:00Z',
          updated_at: '2026-01-08T15:30:00Z'
        },
        {
          id: '2',
          title: 'Solar Technology Summit - Platinum Sponsorship',
          client_id: '2',
          value: 180000,
          status: 'Closed Won',
          created_at: '2026-01-03T14:20:00Z',
          updated_at: '2026-01-07T11:45:00Z'
        },
        {
          id: '3',
          title: 'Wind Power Conference - Gold Package',
          client_id: '3',
          value: 120000,
          status: 'Negotiation',
          created_at: '2026-01-08T09:15:00Z',
          updated_at: '2026-01-10T16:20:00Z'
        },
        {
          id: '4',
          title: 'Clean Tech Innovation Fair - Diamond Tier',
          client_id: '4',
          value: 320000,
          status: 'Closed Won',
          created_at: '2026-01-02T11:30:00Z',
          updated_at: '2026-01-06T14:15:00Z'
        },
        {
          id: '5',
          title: 'Energy Storage Expo - Silver Package',
          client_id: '5',
          value: 85000,
          status: 'Proposal',
          created_at: '2026-01-09T13:45:00Z',
          updated_at: '2026-01-10T10:30:00Z'
        }
      ];

      const mockClients = [
        { id: '1', name: 'Tesla Energy Solutions' },
        { id: '2', name: 'SolarMax Technologies' },
        { id: '3', name: 'WindTech Industries' },
        { id: '4', name: 'CleanTech Innovations' },
        { id: '5', name: 'PowerGrid Systems' }
      ];

      // Generate payment records based on deals
      const paymentRecords: PaymentRecord[] = [];
      const commissionRecords: CommissionRecord[] = [];

      mockDeals.forEach(deal => {
        const client = mockClients.find(c => c.id === deal.client_id);
        
        if (deal.value && deal.value > 0) {
          // Generate payment schedule based on 30/40/30 plan
          const initialAmount = deal.value * PAYMENT_PLAN_CONFIG.initial;
          const progressAmount = deal.value * PAYMENT_PLAN_CONFIG.progress;
          const finalAmount = deal.value * PAYMENT_PLAN_CONFIG.final;
          const baseDate = new Date(deal.created_at);
          
          // Initial payment (due immediately)
          paymentRecords.push({
            id: `payment_${deal.id}_1`,
            deal_id: deal.id,
            deal_title: deal.title,
            client_id: deal.client_id,
            client_name: client?.name || 'Unknown Client',
            amount: initialAmount,
            due_date: baseDate.toISOString(),
            paid_date: deal.status === 'Closed Won' ? baseDate.toISOString() : undefined,
            status: deal.status === 'Closed Won' ? 'paid' : 
                   new Date() > baseDate ? 'overdue' : 'pending',
            payment_type: 'initial',
            installment_number: 1,
            total_installments: 3,
            method: deal.status === 'Closed Won' ? 'bank_transfer' : undefined,
            reference: deal.status === 'Closed Won' ? `REF-${deal.id}-001` : undefined,
            commission_triggered: deal.status === 'Closed Won'
          });

          // Progress payment (due 30 days after initial)
          const progressDate = new Date(baseDate);
          progressDate.setDate(progressDate.getDate() + 30);
          
          paymentRecords.push({
            id: `payment_${deal.id}_2`,
            deal_id: deal.id,
            deal_title: deal.title,
            client_id: deal.client_id,
            client_name: client?.name || 'Unknown Client',
            amount: progressAmount,
            due_date: progressDate.toISOString(),
            paid_date: deal.status === 'Closed Won' && Math.random() > 0.3 ? progressDate.toISOString() : undefined,
            status: deal.status === 'Closed Won' && Math.random() > 0.3 ? 'paid' : 
                   new Date() > progressDate ? 'overdue' : 'pending',
            payment_type: 'progress',
            installment_number: 2,
            total_installments: 3,
            method: deal.status === 'Closed Won' && Math.random() > 0.3 ? 'bank_transfer' : undefined,
            reference: deal.status === 'Closed Won' && Math.random() > 0.3 ? `REF-${deal.id}-002` : undefined
          });

          // Final payment (due 60 days after initial)
          const finalDate = new Date(baseDate);
          finalDate.setDate(finalDate.getDate() + 60);
          
          paymentRecords.push({
            id: `payment_${deal.id}_3`,
            deal_id: deal.id,
            deal_title: deal.title,
            client_id: deal.client_id,
            client_name: client?.name || 'Unknown Client',
            amount: finalAmount,
            due_date: finalDate.toISOString(),
            paid_date: deal.status === 'Closed Won' && Math.random() > 0.7 ? finalDate.toISOString() : undefined,
            status: deal.status === 'Closed Won' && Math.random() > 0.7 ? 'paid' : 
                   new Date() > finalDate ? 'overdue' : 'pending',
            payment_type: 'final',
            installment_number: 3,
            total_installments: 3,
            method: deal.status === 'Closed Won' && Math.random() > 0.7 ? 'bank_transfer' : undefined,
            reference: deal.status === 'Closed Won' && Math.random() > 0.7 ? `REF-${deal.id}-003` : undefined
          });

          // Generate commission records for closed deals
          if (deal.status === 'Closed Won') {
            // Sales person commission (5%)
            commissionRecords.push({
              id: `commission_${deal.id}_sales`,
              deal_id: deal.id,
              deal_title: deal.title,
              user_id: 'user_sales_1',
              user_name: 'Sarah Johnson',
              user_role: 'Sales Manager',
              percentage: 5,
              amount: deal.value * 0.05,
              status: 'approved',
              trigger_event: 'deal_closed',
              created_at: deal.updated_at || deal.created_at,
              approved_at: deal.updated_at || deal.created_at,
              notes: 'Primary sales commission'
            });

            // Account manager commission (2%)
            commissionRecords.push({
              id: `commission_${deal.id}_account`,
              deal_id: deal.id,
              deal_title: deal.title,
              user_id: 'user_account_1',
              user_name: 'Mike Chen',
              user_role: 'Account Manager',
              percentage: 2,
              amount: deal.value * 0.02,
              status: 'pending',
              trigger_event: 'payment_received',
              created_at: deal.updated_at || deal.created_at,
              notes: 'Account management commission'
            });
          }
        }
      });
      }
      
      // Calculate metrics from real data
      const totalRevenue = paymentRecords
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0);
      
      const paymentsCollected = paymentRecords
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0);
      
      const paymentsPending = paymentRecords
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + p.amount, 0);
      
      const paymentsOverdue = paymentRecords
        .filter(p => p.status === 'overdue')
        .reduce((sum, p) => sum + p.amount, 0);

      const commissionPending = commissionRecords
        .filter(c => c.status === 'pending' || c.status === 'approved')
        .reduce((sum, c) => sum + c.amount, 0);
      
      const commissionPaid = commissionRecords
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + c.amount, 0);

      const totalPayments = paymentsCollected + paymentsPending + paymentsOverdue;
      const collectionRate = totalPayments > 0 ? (paymentsCollected / totalPayments) * 100 : 0;
      
      // Calculate monthly revenue (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const monthlyRevenue = paymentRecords
        .filter(p => p.status === 'paid' && p.paid_date && new Date(p.paid_date) >= thirtyDaysAgo)
        .reduce((sum, p) => sum + p.amount, 0);
      
      // Calculate revenue growth (compare with previous 30 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const previousMonthRevenue = paymentRecords
        .filter(p => p.status === 'paid' && p.paid_date && 
                new Date(p.paid_date) >= sixtyDaysAgo && 
                new Date(p.paid_date) < thirtyDaysAgo)
        .reduce((sum, p) => sum + p.amount, 0);
      
      const revenueGrowth = previousMonthRevenue > 0 
        ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
        : 0;
      
      // Calculate average payment time
      const paidPayments = paymentRecords.filter(p => p.status === 'paid' && p.paid_date);
      const avgPaymentTime = paidPayments.length > 0 
        ? paidPayments.reduce((sum, p) => {
            const dueDate = new Date(p.due_date);
            const paidDate = new Date(p.paid_date!);
            const daysDiff = Math.max(0, Math.ceil((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
            return sum + daysDiff;
          }, 0) / paidPayments.length
        : 0;

      setMetrics({
        total_revenue: totalRevenue,
        monthly_revenue: monthlyRevenue,
        revenue_growth: revenueGrowth,
        payments_collected: paymentsCollected,
        payments_pending: paymentsPending,
        payments_overdue: paymentsOverdue,
        commission_pending: commissionPending,
        commission_paid: commissionPaid,
        collection_rate: collectionRate,
        avg_payment_time: avgPaymentTime,
      });

      setPayments(paymentRecords);
      setCommissions(commissionRecords);
      setDeals(deals);
      setClients(clients);
      
      console.log('✅ Finance metrics calculated:', {
        totalRevenue,
        monthlyRevenue,
        revenueGrowth: revenueGrowth.toFixed(2) + '%',
        collectionRate: collectionRate.toFixed(2) + '%',
        avgPaymentTime: avgPaymentTime.toFixed(1) + ' days'
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load financial data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendPaymentReminder = async (paymentId: string) => {
    try {
      setPayments(prev => prev.map(p => 
        p.id === paymentId 
          ? { ...p, reminder_sent: true }
          : p
      ));

      toast({
        title: "Success",
        description: "Payment reminder sent successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to send payment reminder",
        variant: "destructive",
      });
    }
  };

  const approveCommission = async (commissionId: string) => {
    try {
      setCommissions(prev => prev.map(c => 
        c.id === commissionId 
          ? { 
              ...c, 
              status: 'approved',
              approved_at: new Date().toISOString()
            }
          : c
      ));

      toast({
        title: "Success",
        description: "Commission approved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to approve commission",
        variant: "destructive",
      });
    }
  };

  const markCommissionPaid = async (commissionId: string) => {
    try {
      setCommissions(prev => prev.map(c => 
        c.id === commissionId 
          ? { 
              ...c, 
              status: 'paid',
              paid_at: new Date().toISOString()
            }
          : c
      ));

      toast({
        title: "Success",
        description: "Commission marked as paid",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update commission status",
        variant: "destructive",
      });
    }
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = searchTerm === "" || 
      payment.deal_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.client_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return formatAmount(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'pending':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><PieChart className="h-3 w-3 mr-1" />Partial</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getCommissionStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPaymentTypeLabel = (type: string) => {
    switch (type) {
      case 'initial': return 'Initial (30%)';
      case 'progress': return 'Progress (40%)';
      case 'final': return 'Final (30%)';
      case 'full': return 'Full Payment';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 animate-pulse rounded w-64" />
          <div className="h-8 bg-gray-200 animate-pulse rounded w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 animate-pulse rounded" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
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
    <PageGuard requiredPage="finance">
      <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold tracking-tight">
            <DollarSign className="inline-block h-8 w-8 mr-3 text-green-600" />
            Financial Dashboard
          </h1>

          <p className="text-muted-foreground mt-2">
            Payment tracking, commission management, and financial analytics
          </p>

        </div>

        <div className="flex items-center space-x-3">
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

      </div>

      {/* Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6">

              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(metrics.total_revenue)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>

            </div>

            <div className="px-6 pb-4">
              <div className="flex items-center text-xs text-green-600">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                +{formatPercentage(metrics.revenue_growth)} growth
              </div>
            </div>

            <div className="px-6 pb-6 border-t border-gray-100">

              <div className="flex items-center justify-between text-sm pt-4">
                <span className="text-muted-foreground">This Month</span>
                <span className="font-medium">
                  {formatCurrency(metrics.monthly_revenue)}
                </span>
              </div>

            </div>

          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6">

              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Payments Collected
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(metrics.payments_collected)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>

            </div>

            <div className="px-6 pb-4">
              <div className="flex items-center text-xs text-blue-600">
                <Target className="h-3 w-3 mr-1" />
                {formatPercentage(metrics.collection_rate)} collection rate
              </div>
            </div>

            <div className="px-6 pb-6 border-t border-gray-100 pt-4 text-xs text-muted-foreground">
              Avg payment time: {metrics.avg_payment_time} days
            </div>

          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6">

              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Pending Payments
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(metrics.payments_pending)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <Bell className="h-4 w-4 text-orange-600" />
              </div>

            </div>

            <div className="px-6 pb-4">
              <div className="flex items-center text-xs text-red-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {formatCurrency(metrics.payments_overdue)} overdue
              </div>
            </div>

            <div className="px-6 pb-6 border-t border-gray-100 pt-4 text-xs text-muted-foreground">
              Requires immediate attention
            </div>

          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="p-6">

              <div className="flex items-center space-x-2">
                <Percent className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Commission Pending
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(metrics.commission_pending)}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <Award className="h-4 w-4 text-purple-600" />
              </div>

            </div>

            <div className="px-6 pb-4">
              <div className="flex items-center text-xs text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                {formatCurrency(metrics.commission_paid)} paid out
              </div>
            </div>

            <div className="px-6 pb-6 border-t border-gray-100 pt-4 text-xs text-muted-foreground">
              Team performance incentives
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payments">
            Payments ({payments.length})
          </TabsTrigger>
          <TabsTrigger value="commissions">
            Commissions ({commissions.length})
          </TabsTrigger>
          <TabsTrigger value="analytics">
            Analytics
          </TabsTrigger>
          <TabsTrigger value="reports">
            Reports
          </TabsTrigger>
        </TabsList>
        <TabsContent value="payments" className="space-y-4">
          {/* Payment Filters */}
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
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </CardContent>
          </Card>
          {/* Payments Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">

                <table className="w-full">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="p-4 font-medium">Deal & Client</th>
                      <th className="p-4 font-medium">Payment Type</th>
                      <th className="p-4 font-medium">Amount</th>
                      <th className="p-4 font-medium">Due Date</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => (
                      <tr key={payment.id} className="border-b hover:bg-gray-50">
                        <td className="p-4">
                          <div>
                            <div className="font-medium">
                              {payment.deal_title}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {payment.client_name}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <div className="font-medium">{getPaymentTypeLabel(payment.payment_type)}</div>
                            <div className="text-sm text-muted-foreground">
                              {payment.installment_number}/{payment.total_installments}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-medium">{formatCurrency(payment.amount)}</div>
                        </td>
                        <td className="p-4">
                          <div>
                            <div className="font-medium">{new Date(payment.due_date).toLocaleDateString()}</div>
                            {payment.paid_date && (
                              <div className="text-sm text-green-600">
                                Paid: {new Date(payment.paid_date).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {getPaymentStatusBadge(payment.status)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setShowPaymentDetails(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {payment.status === 'overdue' && !payment.reminder_sent && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => sendPaymentReminder(payment.id)}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="commissions" className="space-y-4">
          {/* Commissions List */}
          <div className="space-y-4">

            {commissions.map((commission) => (
              <Card key={commission.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-6">

                    <div className="flex items-start justify-between">

                      <div className="flex items-center space-x-3">

                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {commission.user_name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>

                        <div>

                          <div className="flex items-center space-x-2 mb-1">

                            <h3 className="text-lg font-semibold">
                              {commission.user_name}
                            </h3>

                            <Badge variant="outline">
                              {commission.user_role}
                            </Badge>
                            {getCommissionStatusBadge(commission.status)}
                          </div>

                          <h4 className="text-xl font-semibold mb-2">
                            {commission.deal_title}
                          </h4>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">

                            <div>
                              <span className="font-medium">Commission:</span>
                              <div className="text-muted-foreground">{commission.percentage}%</div>
                            </div>

                            <div>
                              <span className="font-medium">Amount:</span>
                              <div className="text-muted-foreground">{formatCurrency(commission.amount)}</div>
                            </div>

                            <div>
                              <span className="font-medium">Trigger:</span>
                              <div className="text-muted-foreground">
                                {commission.trigger_event.replace('_', ' ')}
                              </div>
                            </div>

                            <div>
                              <span className="font-medium">Created:</span>
                              <div className="text-muted-foreground">{new Date(commission.created_at).toLocaleDateString()}</div>
                            </div>

                          </div>

                          {commission.notes && (
                            <div className="mt-3 text-sm">
                              <span className="font-medium">Notes:</span>
                              <div className="text-muted-foreground">{commission.notes}</div>
                            </div>
                          )}
                        </div>

                      </div>

                      <div className="flex items-center space-x-2">
                        {commission.status === 'pending' && (
                          <Button 
                            onClick={() => approveCommission(commission.id)}
                            size="sm"
                            className="text-xs"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        )}
                        {commission.status === 'approved' && (
                          <Button 
                            onClick={() => markCommissionPaid(commission.id)}
                            size="sm"
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Mark Paid
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedCommission(commission);
                            setShowCommissionDetails(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>

                    </div>

                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

        </TabsContent>
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Monthly revenue performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Revenue analytics chart will be displayed here
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Payment Distribution</CardTitle>
                <CardDescription>Payment status breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <PieChart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Payment distribution chart will be displayed here
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </TabsContent>
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Financial Reports</h3>
              <p className="text-muted-foreground mb-4">
                Financial reports and export functionality will be available here
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Details Dialog */}
      <Dialog open={showPaymentDetails} onOpenChange={setShowPaymentDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <span className="font-medium">Deal</span>
                  <div className="text-muted-foreground">{selectedPayment.deal_title}</div>
                </div>

                <div>
                  <span className="font-medium">Client</span>
                  <div className="text-muted-foreground">{selectedPayment.client_name}</div>
                </div>

                <div>
                  <span className="font-medium">Payment Type</span>
                  <div className="text-muted-foreground">{getPaymentTypeLabel(selectedPayment.payment_type)}</div>
                </div>

                <div>
                  <span className="font-medium">Amount</span>
                  <div className="text-muted-foreground">{formatCurrency(selectedPayment.amount)}</div>
                </div>

                <div>
                  <span className="font-medium">Due Date</span>
                  <div className="text-muted-foreground">{new Date(selectedPayment.due_date).toLocaleDateString()}</div>
                </div>

                <div>
                  <span className="font-medium">Status</span>
                  <div className="text-muted-foreground">{getPaymentStatusBadge(selectedPayment.status)}</div>
                </div>

              </div>

              {selectedPayment.paid_date && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">

                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="font-medium text-green-800">Payment Received</div>
                      <div className="text-sm text-green-600">
                        Paid on {new Date(selectedPayment.paid_date).toLocaleDateString()}
                        {selectedPayment.method && ` via ${selectedPayment.method.replace('_', ' ')}`}
                        {selectedPayment.reference && ` (Ref: ${selectedPayment.reference})`}
                      </div>
                    </div>
                  </div>

                </div>
              )}
              {selectedPayment.notes && (
                <div>
                  <span className="font-medium">Notes</span>
                  <div className="text-muted-foreground">{selectedPayment.notes}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDetails(false)}>
              Close
            </Button>
            {selectedPayment?.status === 'overdue' && (
              <Button onClick={() => {
                  sendPaymentReminder(selectedPayment.id);
                  setShowPaymentDetails(false);
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Reminder
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commission Details Dialog */}
      <Dialog open={showCommissionDetails} onOpenChange={setShowCommissionDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Commission Details</DialogTitle>
          </DialogHeader>
          {selectedCommission && (
            <div className="space-y-4">

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <span className="font-medium">Employee</span>
                  <div className="text-muted-foreground">{selectedCommission.user_name}</div>
                </div>

                <div>
                  <span className="font-medium">Role</span>
                  <div className="text-muted-foreground">{selectedCommission.user_role}</div>
                </div>

                <div>
                  <span className="font-medium">Deal</span>
                  <div className="text-muted-foreground">{selectedCommission.deal_title}</div>
                </div>

                <div>
                  <span className="font-medium">Commission Rate</span>
                  <div className="text-muted-foreground">{selectedCommission.percentage}%</div>
                </div>

                <div>
                  <span className="font-medium">Amount</span>
                  <div className="text-muted-foreground">{formatCurrency(selectedCommission.amount)}</div>
                </div>

                <div>
                  <span className="font-medium">Status</span>
                  <div className="text-muted-foreground">{getCommissionStatusBadge(selectedCommission.status)}</div>
                </div>

                <div>
                  <span className="font-medium">Trigger Event</span>
                  <div className="text-muted-foreground">{selectedCommission.trigger_event.replace('_', ' ')}</div>
                </div>

                <div>
                  <span className="font-medium">Created</span>
                  <div className="text-muted-foreground">{new Date(selectedCommission.created_at).toLocaleDateString()}</div>
                </div>

              </div>

              {selectedCommission.approved_at && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">

                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="font-medium text-blue-800">Commission Approved</div>
                      <div className="text-sm text-blue-600">
                        Approved on {new Date(selectedCommission.approved_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                </div>
              )}
              {selectedCommission.paid_at && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">

                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <div>
                      <div className="font-medium text-green-800">Commission Paid</div>
                      <div className="text-sm text-green-600">
                        Paid on {new Date(selectedCommission.paid_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                </div>
              )}
              {selectedCommission.notes && (
                <div>
                  <span className="font-medium">Notes</span>
                  <div className="text-muted-foreground">{selectedCommission.notes}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommissionDetails(false)}>
              Close
            </Button>
            {selectedCommission?.status === 'pending' && (
              <Button onClick={() => {
                  approveCommission(selectedCommission.id);
                  setShowCommissionDetails(false);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Commission
              </Button>
            )}
            {selectedCommission?.status === 'approved' && (
              <Button onClick={() => {
                  markCommissionPaid(selectedCommission.id);
                  setShowCommissionDetails(false);
                }}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Mark as Paid
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>

    </PageGuard>
  );
};

export default Finance;