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
  User,
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Commission } from '@/types';
import CreateCommissionDialog from '@/components/commissions/CreateCommissionDialog';
import { format } from 'date-fns';

// Mock data
const mockCommissions: (Commission & { 
  salesperson?: { full_name: string }; 
  deal?: { name: string; client?: { company_name: string } }; 
  payment?: { installment_number: number; amount: number } 
})[] = [
  {
    id: '1',
    salesperson_id: '2',
    deal_id: '1',
    payment_id: '1',
    commission_percentage: 5,
    commission_amount: 1800,
    status: 'paid',
    created_at: '2024-01-28T14:30:00Z',
    updated_at: '2024-01-28T14:30:00Z',
    salesperson: { full_name: 'Sarah Johnson' },
    deal: { 
      name: 'Tech Expo 2024 - Premium Booth A1',
      client: { company_name: 'TechCorp Solutions' }
    },
    payment: { installment_number: 1, amount: 36000 }
  },
  {
    id: '2',
    salesperson_id: '2',
    deal_id: '1',
    payment_id: '2',
    commission_percentage: 5,
    commission_amount: 2400,
    status: 'pending',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    salesperson: { full_name: 'Sarah Johnson' },
    deal: { 
      name: 'Tech Expo 2024 - Premium Booth A1',
      client: { company_name: 'TechCorp Solutions' }
    },
    payment: { installment_number: 2, amount: 48000 }
  },
  {
    id: '3',
    salesperson_id: '3',
    deal_id: '2',
    payment_id: '4',
    commission_percentage: 7,
    commission_amount: 1869,
    status: 'payable',
    created_at: '2024-01-12T09:00:00Z',
    updated_at: '2024-01-17T11:15:00Z',
    salesperson: { full_name: 'Mike Rodriguez' },
    deal: { 
      name: 'Healthcare Summit - Platinum Sponsorship',
      client: { company_name: 'MedTech Industries' }
    },
    payment: { installment_number: 1, amount: 26700 }
  },
  {
    id: '4',
    salesperson_id: '2',
    deal_id: '3',
    payment_id: '5',
    commission_percentage: 4,
    commission_amount: 1200,
    status: 'pending',
    created_at: '2024-01-10T15:00:00Z',
    updated_at: '2024-01-10T15:00:00Z',
    salesperson: { full_name: 'Sarah Johnson' },
    deal: { 
      name: 'Green Energy Expo - Gold Package',
      client: { company_name: 'EcoSolutions Ltd' }
    },
    payment: { installment_number: 1, amount: 30000 }
  }
];

const getStatusColor = (status: string) => {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    payable: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800'
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'payable':
      return <AlertTriangle className="h-4 w-4 text-blue-600" />;
    case 'paid':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
};

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState(mockCommissions);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [salespersonFilter, setSalespersonFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const filteredCommissions = commissions.filter(commission => {
    const matchesSearch = commission.deal?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         commission.salesperson?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         commission.deal?.client?.company_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || commission.status === statusFilter;
    const matchesSalesperson = salespersonFilter === 'all' || commission.salesperson_id === salespersonFilter;
    
    return matchesSearch && matchesStatus && matchesSalesperson;
  });

  const handleCreateCommission = (commissionData: any) => {
    const newCommission = {
      id: Date.now().toString(),
      ...commissionData,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setCommissions([...commissions, newCommission]);
    setShowCreateDialog(false);
  };

  // Calculate commission stats
  const commissionStats = {
    total_amount: commissions.reduce((sum, c) => sum + c.commission_amount, 0),
    paid_amount: commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commission_amount, 0),
    payable_amount: commissions.filter(c => c.status === 'payable').reduce((sum, c) => sum + c.commission_amount, 0),
    pending_amount: commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.commission_amount, 0),
    total_count: commissions.length,
    paid_count: commissions.filter(c => c.status === 'paid').length,
    payable_count: commissions.filter(c => c.status === 'payable').length,
    pending_count: commissions.filter(c => c.status === 'pending').length
  };

  // Get unique salespeople for filter
  const uniqueSalespeople = Array.from(
    new Set(commissions.map(c => ({ id: c.salesperson_id, name: c.salesperson?.full_name || 'Unknown' })))
  );

  // Calculate salesperson performance
  const salespersonPerformance = uniqueSalespeople.map(person => {
    const personCommissions = commissions.filter(c => c.salesperson_id === person.id);
    return {
      ...person,
      total_commissions: personCommissions.reduce((sum, c) => sum + c.commission_amount, 0),
      paid_commissions: personCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.commission_amount, 0),
      pending_commissions: personCommissions.filter(c => c.status !== 'paid').reduce((sum, c) => sum + c.commission_amount, 0),
      commission_count: personCommissions.length
    };
  }).sort((a, b) => b.total_commissions - a.total_commissions);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-crm-primary-text">Commission Management</h1>
          <p className="text-crm-secondary-text">Track and manage sales commissions and payouts</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="crm-button-primary">
          <Plus className="h-4 w-4 mr-2" />
          Add Commission
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="crm-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-crm-secondary-text">Total Commissions</p>
                <p className="text-2xl font-semibold text-crm-primary-text font-tabular">
                  ${commissionStats.total_amount.toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="crm-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-crm-secondary-text">Paid Out</p>
                <p className="text-2xl font-semibold text-green-600 font-tabular">
                  ${commissionStats.paid_amount.toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="crm-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-crm-secondary-text">Ready to Pay</p>
                <p className="text-2xl font-semibold text-blue-600 font-tabular">
                  ${commissionStats.payable_amount.toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="crm-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-crm-secondary-text">Pending</p>
                <p className="text-2xl font-semibold text-yellow-600 font-tabular">
                  ${commissionStats.pending_amount.toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="commissions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="commissions">All Commissions ({commissionStats.total_count})</TabsTrigger>
          <TabsTrigger value="payable">Ready to Pay ({commissionStats.payable_count})</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="commissions" className="space-y-6">
          {/* Filters */}
          <Card className="crm-card">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-crm-secondary-text" />
                    <Input
                      placeholder="Search commissions..."
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
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="payable">Payable</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={salespersonFilter} onValueChange={setSalespersonFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by salesperson" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Salespeople</SelectItem>
                    {uniqueSalespeople.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Commissions Table */}
          <Card className="crm-card">
            <CardHeader>
              <CardTitle>Commission Records</CardTitle>
              <CardDescription>
                {filteredCommissions.length} commissions found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal</TableHead>
                    <TableHead>Salesperson</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Commission %</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommissions.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-crm-primary-text">{commission.deal?.name}</p>
                          <p className="text-sm text-crm-secondary-text">{commission.deal?.client?.company_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-crm-secondary-text" />
                          <span>{commission.salesperson?.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">Installment #{commission.payment?.installment_number}</p>
                          <p className="text-sm text-crm-secondary-text font-tabular">
                            ${commission.payment?.amount.toLocaleString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <TrendingUp className="h-4 w-4 text-crm-secondary-text" />
                          <span className="font-tabular">{commission.commission_percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-4 w-4 text-crm-secondary-text" />
                          <span className="font-tabular font-medium">
                            {commission.commission_amount.toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(commission.status)}
                          <Badge className={getStatusColor(commission.status)}>
                            {commission.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-crm-secondary-text" />
                          <span className="text-sm">
                            {format(new Date(commission.created_at), 'MMM dd, yyyy')}
                          </span>
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
                              Edit Commission
                            </DropdownMenuItem>
                            {commission.status === 'payable' && (
                              <DropdownMenuItem>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark as Paid
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Commission
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

        <TabsContent value="payable" className="space-y-6">
          <Card className="crm-card">
            <CardHeader>
              <CardTitle className="text-blue-600">Ready for Payout</CardTitle>
              <CardDescription>
                Commissions that are ready to be paid out to salespeople
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {commissions.filter(c => c.status === 'payable').map((commission) => (
                  <div key={commission.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-crm-primary-text">{commission.deal?.name}</h4>
                        <p className="text-sm text-crm-secondary-text">
                          {commission.salesperson?.full_name} • {commission.commission_percentage}% commission
                        </p>
                        <p className="text-xs text-crm-secondary-text mt-1">
                          Payment #{commission.payment?.installment_number} • Created {format(new Date(commission.created_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-600 font-tabular text-lg">
                          ${commission.commission_amount.toLocaleString()}
                        </p>
                        <Button size="sm" className="mt-2">
                          Process Payment
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card className="crm-card">
            <CardHeader>
              <CardTitle>Salesperson Performance</CardTitle>
              <CardDescription>
                Commission earnings by salesperson
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {salespersonPerformance.map((person, index) => (
                  <div key={person.id} className="border border-crm-border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-crm-accent rounded-full flex items-center justify-center text-white font-semibold">
                          #{index + 1}
                        </div>
                        <div>
                          <h4 className="font-medium text-crm-primary-text">{person.name}</h4>
                          <p className="text-sm text-crm-secondary-text">
                            {person.commission_count} commissions
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-crm-primary-text font-tabular">
                          ${person.total_commissions.toLocaleString()}
                        </p>
                        <div className="flex items-center space-x-4 text-sm mt-1">
                          <span className="text-green-600">
                            Paid: ${person.paid_commissions.toLocaleString()}
                          </span>
                          <span className="text-yellow-600">
                            Pending: ${person.pending_commissions.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Commission Dialog */}
      <CreateCommissionDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateCommission}
      />
    </div>
  );
}