import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Percent,
  DollarSign,
  TrendingUp,
  User,
  Target,
  Calendar,
  RefreshCw,
  Download,
  Filter,
  Search,
  Eye,
  Edit,
  Plus,
  Award,
  BarChart3,
  Users,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import SupabaseService, { settingsService } from '@/services/supabaseService';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';

interface CommissionSchedule {
  sales_person_name?:string;
  id: string;
  deal_id: string;
  payment_schedule_id: string;
  sales_person_id: string;
  commission_name: string;
  commission_percentage: number;
  commission_amount: number;
  due_date: string;
  status: 'pending' | 'approved' | 'paid' | 'cancelled' | 'disputed';
  paid_date?: string;
  paid_amount: number;
  payment_method?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  deal_title?: string;
  client_name?: string;
  payment_name?: string;
  payment_status?: string;
}

interface CommissionSummary {
  sales_person_id: string;
  sales_person_name: string;
  total_deals: number;
  total_commission_amount: number;
  paid_commission_amount: number;
  pending_commission_amount: number;
  approved_commission_amount: number;
  disputed_commission_amount: number;
}

export default function Commissions() {
  const [commissionSchedules, setCommissionSchedules] = useState<CommissionSchedule[]>([]);
  const [commissionSummary, setCommissionSummary] = useState<CommissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('current');
  const [activeTab, setActiveTab] = useState('commissions');
  const { formatAmount } = useCurrency();
  const { can } = useAuth();

  // Load commission data
  const loadCommissionData = async () => {
    try {
      setLoading(true);
      console.log('🏦 Loading commission data...');

      // Load commission schedules and summary in parallel
      const [schedules, summary] = await Promise.all([
        settingsService.getAllCommissionSchedules(),
        settingsService.getCommissionSummary()
      ]);

      setCommissionSchedules(schedules);
      setCommissionSummary(summary);

      console.log('✅ Commission data loaded:', {
        schedules: schedules.length,
        summary: summary.length
      });

      toast({
        title: 'Commission Data Loaded',
        description: `Loaded ${schedules.length} commission schedules and ${summary.length} sales summaries.`,
      });
    } catch (error) {
      console.error('❌ Error loading commission data:', error);
      toast({
        title: 'Error Loading Data',
        description: 'Failed to load commission data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommissionData();
  }, []);

  // Handle commission status update
  const handleStatusUpdate = async (commissionId: string, newStatus: string, paidAmount?: number, paymentMethod?: string, notes?: string) => {
    try {
      console.log('🏦 Updating commission status:', { commissionId, newStatus });

      const success = await settingsService.updateCommissionStatus(
        commissionId,
        newStatus,
        paidAmount,
        paymentMethod,
        notes
      );

      if (success) {
        toast({
          title: 'Commission Updated',
          description: `Commission status updated to ${newStatus}.`,
        });

        // Reload data to reflect changes
        await loadCommissionData();
      } else {
        throw new Error('Failed to update commission status');
      }
    } catch (error) {
      console.error('❌ Error updating commission status:', error);
      toast({
        title: 'Update Failed',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  // Sync missing commissions for existing deals
  const syncMissingCommissions = async () => {
    try {
      setLoading(true);
      console.log('🔄 Syncing missing commissions for existing deals...');

      // This would ideally call a service method to create missing commissions
      // For now, we'll just reload the data as the SQL script already created them
      await loadCommissionData();

      toast({
        title: 'Commission Sync Complete',
        description: 'Commission records refreshed. Laravel generates commissions automatically when deals are saved.',
      });
    } catch (error) {
      console.error('❌ Error syncing commissions:', error);
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync missing commissions. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCommissions = commissionSchedules.filter(commission => {
    const matchesSearch = commission.sales_person_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         commission.sales_person_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         commission.deal_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         commission.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         commission.commission_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || commission.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending': return { color: 'bg-yellow-100 text-yellow-800', icon: Clock };
      case 'approved': return { color: 'bg-blue-100 text-blue-800', icon: CheckCircle };
      case 'paid': return { color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'disputed': return { color: 'bg-red-100 text-red-800', icon: AlertCircle };
      case 'cancelled': return { color: 'bg-gray-100 text-gray-800', icon: AlertCircle };
      default: return { color: 'bg-gray-100 text-gray-800', icon: Clock };
    }
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Calculate summary statistics from commission schedules
  const totalCommissions = commissionSchedules.reduce((sum, c) => sum + c.commission_amount, 0);
  const paidCommissions = commissionSchedules.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commission_amount, 0);
  const pendingCommissions = commissionSchedules.filter(c => c.status === 'pending' || c.status === 'approved').reduce((sum, c) => sum + c.commission_amount, 0);
  const disputedCommissions = commissionSchedules.filter(c => c.status === 'disputed').reduce((sum, c) => sum + c.commission_amount, 0);
  const avgCommissionRate = commissionSchedules.reduce((sum, c) => sum + c.commission_percentage, 0) / commissionSchedules.length || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <h2 className="text-xl font-semibold mt-4">
            <DollarSign className="inline-block h-6 w-6 mr-2" />
            Loading commissions...
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">

          <div>

            <h1 className="text-3xl font-bold tracking-tight">

              <Percent className="inline-block h-8 w-8 mr-3 text-blue-600" />
              Commission Management
            </h1>

            <p className="text-muted-foreground mt-2">
              Track sales compensation and performance metrics
            </p>

          </div>

          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button variant="outline" size="sm" onClick={loadCommissionData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={syncMissingCommissions}>
              <Target className="h-4 w-4 mr-2" />
              Sync Missing
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Process Commissions
            </Button>
          </div>

        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          <Card>
            <CardContent className="p-6">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Commissions
                  </p>
                  <p className="text-2xl font-bold">
                    {formatAmount(totalCommissions)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {commissionSchedules.length} transactions
                  </p>
                </div>

                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </div>

              </div>

            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Paid Out
                  </p>
                  <p className="text-2xl font-bold">
                    {formatAmount(paidCommissions)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatPercentage((paidCommissions / totalCommissions) * 100)}
                  </p>
                </div>

                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>

              </div>

            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Pending
                  </p>
                  <p className="text-2xl font-bold">
                    {formatAmount(pendingCommissions)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatPercentage((pendingCommissions / totalCommissions) * 100)}
                  </p>
                </div>

                <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                  <Clock className="h-4 w-4 text-orange-600" />
                </div>

              </div>

            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Avg Rate
                  </p>
                  <p className="text-2xl font-bold">
                    {formatPercentage(avgCommissionRate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Commission rate
                  </p>
                </div>

                <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Percent className="h-4 w-4 text-purple-600" />
                </div>

              </div>

            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'commissions', label: 'Commissions', icon: DollarSign },
              { id: 'sales-reps', label: 'Sales Team', icon: Users }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'commissions' && (
          <div className="space-y-6">

            {/* Filters and Search */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">

                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search commissions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Paid</option>
                    <option value="disputed">Disputed</option>
                  </select>
                  <select
                    value={periodFilter}
                    onChange={(e) => setPeriodFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="current">Current Period</option>
                    <option value="jan2024">January 2024</option>
                    <option value="dec2023">December 2023</option>
                    <option value="all">All Periods</option>
                  </select>
                </div>

              </CardContent>
            </Card>

            {/* Commissions List */}
            <div className="space-y-4">

              {filteredCommissions.map((commission) => {
                const statusConfig = getStatusConfig(commission.status);
                const StatusIcon = statusConfig.icon;
                return (
                  <Card key={commission.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="p-6">

                        <div className="flex items-start justify-between">

                          <div className="flex items-center space-x-4">

                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                              <Percent className="h-6 w-6 text-blue-600" />
                            </div>

                            <div className="flex-1">

                              <div className="flex items-center space-x-2 mb-2">
                                <h3 className="text-lg font-semibold">
                                  {commission.commission_name}
                                </h3>
                                <Badge className={statusConfig.color}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {commission.status}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">

                                <div>
                                  <span className="font-medium">Sales Person:</span>
                                  <div className="text-muted-foreground">{commission.sales_person_name || commission.sales_person_id}</div>
                                </div>

                                <div>
                                  <span className="font-medium">Client:</span>
                                  <div className="text-muted-foreground">{commission.client_name || 'N/A'}</div>
                                </div>

                                <div>
                                  <span className="font-medium">Deal:</span>
                                  <div className="text-muted-foreground">{commission.deal_title || 'N/A'}</div>
                                </div>

                                <div>
                                  <span className="font-medium">Commission Rate:</span>
                                  <div className="text-muted-foreground">{formatPercentage(commission.commission_percentage)}</div>
                                </div>

                              </div>

                              <div className="flex items-center justify-between">

                                <div>

                                  <div className="text-2xl font-bold text-green-600">
                                    {formatAmount(commission.commission_amount)}
                                  </div>

                                  <div className="text-sm text-muted-foreground">
                                    Due: {new Date(commission.due_date).toLocaleDateString()}
                                    {commission.paid_date && (
                                      <span className="text-green-600">
                                        • Paid: {new Date(commission.paid_date).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>

                                </div>

                              </div>

                            </div>

                          </div>

                          <div className="flex items-center space-x-2">
                            {commission.status === 'pending' && can('commissions.approve') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusUpdate(commission.id, 'approved')}
                                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                            )}
                            {commission.status === 'approved' && can('commissions.pay') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusUpdate(commission.id, 'paid', commission.commission_amount, 'Bank Transfer')}
                                className="text-green-600 border-green-200 hover:bg-green-50"
                              >
                                <DollarSign className="h-4 w-4 mr-1" />
                                Mark Paid
                              </Button>
                            )}
                            {commission.status !== 'paid' && commission.status !== 'cancelled' && can('commissions.edit') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusUpdate(commission.id, 'disputed')}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <AlertCircle className="h-4 w-4 mr-1" />
                                Dispute
                              </Button>
                            )}
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>

                        </div>

                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

          </div>

        )}

        {activeTab === 'sales-reps' && (
          <div className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {commissionSummary.map((summary) => (
                <Card key={summary.sales_person_id}>
                  <CardContent className="p-6">
                    <div className="space-y-4">

                      <div className="flex items-center space-x-3">

                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 text-blue-600" />
                        </div>

                        <div>

                          <h3 className="text-lg font-semibold">
                            {summary.sales_person_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {summary.sales_person_id}
                          </p>

                        </div>
                        <Badge variant="outline" className="ml-auto">
                          {summary.total_deals} deals
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">

                        <div>
                          <span className="font-medium">Total Commission</span>
                          <div className="text-lg font-bold">{formatAmount(summary.total_commission_amount)}</div>
                        </div>

                        <div>
                          <span className="font-medium">Approved</span>
                          <div className="text-lg font-bold">{formatAmount(summary.approved_commission_amount)}</div>
                        </div>

                        <div>
                          <span className="font-medium">Paid</span>
                          <div className="text-lg font-bold text-green-600">{formatAmount(summary.paid_commission_amount)}</div>
                        </div>

                        <div>
                          <span className="font-medium">Pending</span>
                          <div className="text-lg font-bold text-orange-600">{formatAmount(summary.pending_commission_amount)}</div>
                        </div>

                      </div>

                      {summary.disputed_commission_amount > 0 && (
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200">

                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-red-800">Disputed</span>
                            <span className="font-bold text-red-600">{formatAmount(summary.disputed_commission_amount)}</span>
                          </div>

                        </div>
                      )}
                      <div className="space-y-2">

                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">Payment Rate</span>
                          <span className="font-bold">
                            {summary.total_commission_amount > 0
                              ? formatPercentage((summary.paid_commission_amount / summary.total_commission_amount) * 100)
                              : '0%'
                            }
                          </span>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${summary.total_commission_amount > 0
                                ? Math.min((summary.paid_commission_amount / summary.total_commission_amount) * 100, 100)
                                : 0
                              }%`
                            }}
                          />
                        </div>

                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">

                        <div className="text-sm text-muted-foreground">
                          <Award className="inline-block h-4 w-4 mr-1" />
                          {summary.total_deals} deals
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Filter commissions for this salesperson
                            setSearchTerm(summary.sales_person_id);
                            setActiveTab('commissions');
                          }}
                        >
                          View Commissions
                        </Button>
                      </div>

                    </div>

                  </CardContent>
                </Card>
              ))}
            </div>

          </div>

        )}
      </div>

    </div>

  );
}
