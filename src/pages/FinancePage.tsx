import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Download
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Payment, Deal } from '@/types';
import CreatePaymentDialog from '@/components/finance/CreatePaymentDialog';
import { format } from 'date-fns';

// Mock data
const mockPayments: (Payment & { deal?: Deal })[] = [
  {
    id: '1',
    deal_id: '1',
    installment_number: 1,
    amount: 36000,
    due_date: '2024-02-01',
    paid_date: '2024-01-28',
    payment_method: 'Bank Transfer',
    status: 'paid',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-28T14:30:00Z',
    deal: {
      id: '1',
      name: 'Tech Expo 2024 - Premium Booth A1',
      client_id: '1',
      expo_id: '1',
      type: 'booth',
      status: 'terms_finalized',
      assigned_salesperson_id: '1',
      expected_value: 120000,
      expected_close_date: '2024-02-15',
      created_at: '2024-01-10T10:00:00Z',
      updated_at: '2024-01-17T14:30:00Z',
      created_by: '1'
    }
  },
  {
    id: '2',
    deal_id: '1',
    installment_number: 2,
    amount: 48000,
    due_date: '2024-03-01',
    status: 'pending',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    deal: {
      id: '1',
      name: 'Tech Expo 2024 - Premium Booth A1',
      client_id: '1',
      expo_id: '1',
      type: 'booth',
      status: 'terms_finalized',
      assigned_salesperson_id: '1',
      expected_value: 120000,
      expected_close_date: '2024-02-15',
      created_at: '2024-01-10T10:00:00Z',
      updated_at: '2024-01-17T14:30:00Z',
      created_by: '1'
    }
  },
  {
    id: '3',
    deal_id: '1',
    installment_number: 3,
    amount: 36000,
    due_date: '2024-04-01',
    status: 'pending',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    deal: {
      id: '1',
      name: 'Tech Expo 2024 - Premium Booth A1',
      client_id: '1',
      expo_id: '1',
      type: 'booth',
      status: 'terms_finalized',
      assigned_salesperson_id: '1',
      expected_value: 120000,
      expected_close_date: '2024-02-15',
      created_at: '2024-01-10T10:00:00Z',
      updated_at: '2024-01-17T14:30:00Z',
      created_by: '1'
    }
  },
  {
    id: '4',
    deal_id: '2',
    installment_number: 1,
    amount: 26700,
    due_date: '2024-01-15',
    status: 'overdue',
    created_at: '2024-01-12T09:00:00Z',
    updated_at: '2024-01-17T11:15:00Z',
    deal: {
      id: '2',
      name: 'Healthcare Summit - Platinum Sponsorship',
      client_id: '2',
      expo_id: '2',
      type: 'sponsor',
      status: 'strategy_proposal',
      assigned_salesperson_id: '2',
      expected_value: 89000,
      expected_close_date: '2024-02-20',
      created_at: '2024-01-12T09:00:00Z',
      updated_at: '2024-01-17T11:15:00Z',
      created_by: '2'
    }
  }
];

const getPaymentStatusColor = (status: string) => {
  const colors = {
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const getPaymentStatusIcon = (status: string) => {
  switch (status) {
    case 'paid':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'overdue':
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
};

export default function FinancePage() {
  const [payments, setPayments] = useState(mockPayments);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.deal?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         payment.payment_method?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleCreatePayment = (paymentData: any) => {
    const newPayment = {
      id: Date.now().toString(),
      ...paymentData,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setPayments([...payments, newPayment]);
    setShowCreateDialog(false);
  };

  // Calculate financial stats
  const totalRevenue = payments.reduce((sum, p) => p.status === 'paid' ? sum + p.amount : sum, 0);
  const pendingAmount = payments.reduce((sum, p) => p.status === 'pending' ? sum + p.amount : sum, 0);
  const overdueAmount = payments.reduce((sum, p) => p.status === 'overdue' ? sum + p.amount : sum, 0);
  const totalExpected = payments.reduce((sum, p) => sum + p.amount, 0);
  const collectionRate = totalExpected > 0 ? (totalRevenue / totalExpected) * 100 : 0;

  const paymentStats = {
    total_revenue: totalRevenue,
    pending_amount: pendingAmount,
    overdue_amount: overdueAmount,
    collection_rate: collectionRate,
    total_payments: payments.length,
    paid_count: payments.filter(p => p.status === 'paid').length,
    pending_count: payments.filter(p => p.status === 'pending').length,
    overdue_count: payments.filter(p => p.status === 'overdue').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-crm-primary-text">Finance & Payments</h1>
          <p className="text-crm-secondary-text">Track payments, installments, and financial performance</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="crm-button-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Payment
          </Button>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="crm-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-crm-secondary-text">Total Revenue</p>
                <p className="text-2xl font-semibold text-crm-primary-text font-tabular">
                  ${paymentStats.total_revenue.toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="crm-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-crm-secondary-text">Pending Amount</p>
                <p className="text-2xl font-semibold text-crm-primary-text font-tabular">
                  ${paymentStats.pending_amount.toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="crm-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-crm-secondary-text">Overdue Amount</p>
                <p className="text-2xl font-semibold text-crm-primary-text font-tabular">
                  ${paymentStats.overdue_amount.toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="crm-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-crm-secondary-text">Collection Rate</p>
                <p className="text-2xl font-semibold text-crm-primary-text font-tabular">
                  {paymentStats.collection_rate.toFixed(1)}%
                </p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-3">
              <Progress value={paymentStats.collection_rate} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments" className="space-y-6">
        <TabsList>
          <TabsTrigger value="payments">All Payments</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({paymentStats.overdue_count})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({paymentStats.pending_count})</TabsTrigger>
          <TabsTrigger value="cashflow">Cashflow</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-6">
          {/* Filters */}
          <Card className="crm-card">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-crm-secondary-text" />
                    <Input
                      placeholder="Search payments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Payments Table */}
          <Card className="crm-card">
            <CardHeader>
              <CardTitle>Payment Schedule</CardTitle>
              <CardDescription>
                {filteredPayments.length} payments found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal</TableHead>
                    <TableHead>Installment</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Paid Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-crm-primary-text">{payment.deal?.name}</p>
                          <p className="text-xs text-crm-secondary-text">Deal ID: {payment.deal_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          #{payment.installment_number}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-4 w-4 text-crm-secondary-text" />
                          <span className="font-tabular font-medium">
                            {payment.amount.toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-crm-secondary-text" />
                          <span className="text-sm">
                            {format(new Date(payment.due_date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {payment.paid_date ? (
                          <span className="text-sm">
                            {format(new Date(payment.paid_date), 'MMM dd, yyyy')}
                          </span>
                        ) : (
                          <span className="text-sm text-crm-secondary-text">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{payment.payment_method || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getPaymentStatusIcon(payment.status)}
                          <Badge className={getPaymentStatusColor(payment.status)}>
                            {payment.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Payment
                            </DropdownMenuItem>
                            {payment.status === 'pending' && (
                              <DropdownMenuItem>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark as Paid
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Cancel Payment
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overdue">
          <Card className="crm-card">
            <CardHeader>
              <CardTitle className="text-red-600">Overdue Payments</CardTitle>
              <CardDescription>
                Payments that are past their due date and require immediate attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payments.filter(p => p.status === 'overdue').map((payment) => (
                  <div key={payment.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-crm-primary-text">{payment.deal?.name}</h4>
                        <p className="text-sm text-crm-secondary-text">
                          Installment #{payment.installment_number} • Due: {format(new Date(payment.due_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-red-600 font-tabular">
                          ${payment.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-red-500">
                          {Math.ceil((new Date().getTime() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24))} days overdue
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card className="crm-card">
            <CardHeader>
              <CardTitle>Pending Payments</CardTitle>
              <CardDescription>
                Upcoming payments that are due soon
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payments.filter(p => p.status === 'pending').map((payment) => (
                  <div key={payment.id} className="border border-crm-border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-crm-primary-text">{payment.deal?.name}</h4>
                        <p className="text-sm text-crm-secondary-text">
                          Installment #{payment.installment_number} • Due: {format(new Date(payment.due_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-crm-primary-text font-tabular">
                          ${payment.amount.toLocaleString()}
                        </p>
                        <Button size="sm" className="mt-2">
                          Mark as Paid
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cashflow">
          <Card className="crm-card">
            <CardHeader>
              <CardTitle>Cashflow Dashboard</CardTitle>
              <CardDescription>
                Financial overview and projections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-sm text-crm-secondary-text">This Month</p>
                  <p className="text-2xl font-semibold text-green-600 font-tabular">
                    ${payments.filter(p => p.status === 'paid' && new Date(p.paid_date || '').getMonth() === new Date().getMonth()).reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-crm-secondary-text">Next Month</p>
                  <p className="text-2xl font-semibold text-blue-600 font-tabular">
                    ${payments.filter(p => p.status === 'pending' && new Date(p.due_date).getMonth() === new Date().getMonth() + 1).reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-crm-secondary-text">Total Pipeline</p>
                  <p className="text-2xl font-semibold text-crm-primary-text font-tabular">
                    ${payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Payment Dialog */}
      <CreatePaymentDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreatePayment}
      />
    </div>
  );
}