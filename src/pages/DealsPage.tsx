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
  User,
  Building2,
  TrendingUp,
  Clock
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Deal, DealStatus, Client, Expo, User as UserType } from '@/types';
import CreateDealDialog from '@/components/deals/CreateDealDialog';
import DealDetailsDialog from '@/components/deals/DealDetailsDialog';

// Mock data
const mockDeals: Deal[] = [
  {
    id: '1',
    name: 'Tech Expo 2024 - Premium Booth A1',
    client_id: '1',
    expo_id: '1',
    type: 'booth',
    status: 'terms_finalized',
    assigned_salesperson_id: '1',
    expected_value: 125000,
    negotiated_value: 120000,
    expected_close_date: '2024-02-15',
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-17T14:30:00Z',
    created_by: '1',
    client: {
      id: '1',
      type: 'exhibitor',
      company_name: 'TechCorp Solutions',
      contact_person: 'John Smith',
      email: 'john@techcorp.com',
      phone: '+1-555-0123',
      industry: 'Technology',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: '1'
    },
    expo: {
      id: '1',
      name: 'Tech Expo 2024',
      location: 'Convention Center A',
      start_date: '2024-03-15',
      end_date: '2024-03-17',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: '1'
    },
    assigned_salesperson: {
      id: '1',
      email: 'sarah@spaceorganizing.com',
      full_name: 'Sarah Johnson',
      role: 'sales_executive',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  },
  {
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
    created_by: '2',
    client: {
      id: '2',
      type: 'sponsor',
      company_name: 'MedTech Industries',
      contact_person: 'Dr. Emily Chen',
      email: 'emily@medtech.com',
      phone: '+1-555-0456',
      industry: 'Healthcare',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: '1'
    },
    expo: {
      id: '2',
      name: 'Healthcare Summit 2024',
      location: 'Medical Center Hall',
      start_date: '2024-04-10',
      end_date: '2024-04-12',
      status: 'planning',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      created_by: '1'
    },
    assigned_salesperson: {
      id: '2',
      email: 'mike@spaceorganizing.com',
      full_name: 'Mike Rodriguez',
      role: 'sales_manager',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  }
];

const dealStatuses: { value: DealStatus; label: string; color: string }[] = [
  { value: 'lead_created', label: 'Lead Created', color: 'bg-gray-100 text-gray-800' },
  { value: 'talking', label: 'Talking', color: 'bg-blue-100 text-blue-800' },
  { value: 'meeting', label: 'Meeting', color: 'bg-green-100 text-green-800' },
  { value: 'strategy_proposal', label: 'Strategy Proposal', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'objection_handling', label: 'Objection Handling', color: 'bg-orange-100 text-orange-800' },
  { value: 'terms_finalized', label: 'Terms Finalized', color: 'bg-purple-100 text-purple-800' },
  { value: 'closed_won', label: 'Closed Won', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'closed_lost', label: 'Closed Lost', color: 'bg-red-100 text-red-800' },
  { value: 'failed', label: 'Failed', color: 'bg-red-100 text-red-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-800' }
];

const getStatusColor = (status: DealStatus) => {
  const statusConfig = dealStatuses.find(s => s.value === status);
  return statusConfig?.color || 'bg-gray-100 text-gray-800';
};

const getStatusLabel = (status: DealStatus) => {
  const statusConfig = dealStatuses.find(s => s.value === status);
  return statusConfig?.label || status;
};

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>(mockDeals);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const filteredDeals = deals.filter(deal => {
    const matchesSearch = deal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         deal.client?.company_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || deal.status === statusFilter;
    const matchesType = typeFilter === 'all' || deal.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleViewDeal = (deal: Deal) => {
    setSelectedDeal(deal);
    setShowDetailsDialog(true);
  };

  const handleCreateDeal = (dealData: any) => {
    // In real app, this would make an API call
    const newDeal: Deal = {
      id: Date.now().toString(),
      ...dealData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: '1' // Current user
    };
    setDeals([...deals, newDeal]);
    setShowCreateDialog(false);
  };

  const pipelineStats = dealStatuses.map(status => ({
    ...status,
    count: deals.filter(deal => deal.status === status.value).length,
    value: deals
      .filter(deal => deal.status === status.value)
      .reduce((sum, deal) => sum + (deal.negotiated_value || deal.expected_value), 0)
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-crm-primary-text">Deals Pipeline</h1>
          <p className="text-crm-secondary-text">Manage your sales pipeline and track deal progress</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="crm-button-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create Deal
        </Button>
      </div>

      {/* Pipeline Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {pipelineStats.slice(0, 5).map((status) => (
          <Card key={status.value} className="crm-card">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm font-medium text-crm-secondary-text">{status.label}</p>
                <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{status.count}</p>
                <p className="text-xs text-crm-secondary-text font-tabular">
                  ${status.value.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="crm-card">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-crm-secondary-text" />
                <Input
                  placeholder="Search deals, clients..."
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
                <SelectItem value="all">All Statuses</SelectItem>
                {dealStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="booth">Booth</SelectItem>
                <SelectItem value="sponsor">Sponsor</SelectItem>
                <SelectItem value="sector_sponsor">Sector Sponsor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Deals Table */}
      <Card className="crm-card">
        <CardHeader>
          <CardTitle>All Deals</CardTitle>
          <CardDescription>
            {filteredDeals.length} deals found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Expo</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Salesperson</TableHead>
                <TableHead>Close Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-crm-primary-text">{deal.name}</p>
                      <p className="text-xs text-crm-secondary-text">
                        Created {new Date(deal.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-crm-secondary-text" />
                      <div>
                        <p className="font-medium">{deal.client?.company_name}</p>
                        <p className="text-xs text-crm-secondary-text">{deal.client?.contact_person}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-crm-secondary-text" />
                      <div>
                        <p className="font-medium">{deal.expo?.name}</p>
                        <p className="text-xs text-crm-secondary-text">{deal.expo?.location}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {deal.type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(deal.status)}>
                      {getStatusLabel(deal.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <DollarSign className="h-4 w-4 text-crm-secondary-text" />
                      <span className="font-tabular font-medium">
                        {(deal.negotiated_value || deal.expected_value).toLocaleString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-crm-secondary-text" />
                      <span>{deal.assigned_salesperson?.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4 text-crm-secondary-text" />
                      <span className="text-sm">
                        {new Date(deal.expected_close_date).toLocaleDateString()}
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
                        <DropdownMenuItem onClick={() => handleViewDeal(deal)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Deal
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Deal
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

      {/* Create Deal Dialog */}
      <CreateDealDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateDeal}
      />

      {/* Deal Details Dialog */}
      {selectedDeal && (
        <DealDetailsDialog
          deal={selectedDeal}
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
        />
      )}
    </div>
  );
}