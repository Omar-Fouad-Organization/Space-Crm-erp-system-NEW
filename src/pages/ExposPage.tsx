import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  Users,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Expo } from '@/types';
import CreateExpoDialog from '@/components/expos/CreateExpoDialog';
import { format } from 'date-fns';

// Mock data
const mockExpos: Expo[] = [
  {
    id: '1',
    name: 'Tech Expo 2024',
    location: 'Convention Center A, New York',
    start_date: '2024-03-15',
    end_date: '2024-03-17',
    status: 'active',
    notes: 'Major technology exhibition with 500+ exhibitors expected',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    created_by: '1'
  },
  {
    id: '2',
    name: 'Healthcare Summit 2024',
    location: 'Medical Center Hall, Boston',
    start_date: '2024-04-10',
    end_date: '2024-04-12',
    status: 'planning',
    notes: 'Healthcare innovation summit focusing on digital health solutions',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    created_by: '1'
  },
  {
    id: '3',
    name: 'Green Energy Expo 2024',
    location: 'Eco Center, San Francisco',
    start_date: '2024-05-20',
    end_date: '2024-05-22',
    status: 'planning',
    notes: 'Renewable energy and sustainability expo',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    created_by: '1'
  },
  {
    id: '4',
    name: 'Finance World 2023',
    location: 'Financial District Center, Chicago',
    start_date: '2023-11-15',
    end_date: '2023-11-17',
    status: 'completed',
    notes: 'Successfully completed financial services expo',
    created_at: '2023-09-01T00:00:00Z',
    updated_at: '2023-11-20T00:00:00Z',
    created_by: '1'
  }
];

const getStatusColor = (status: string) => {
  const colors = {
    planning: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800'
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

export default function ExposPage() {
  const [expos, setExpos] = useState<Expo[]>(mockExpos);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const filteredExpos = expos.filter(expo => {
    const matchesSearch = expo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         expo.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || expo.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleCreateExpo = (expoData: any) => {
    const newExpo: Expo = {
      id: Date.now().toString(),
      ...expoData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: '1'
    };
    setExpos([...expos, newExpo]);
    setShowCreateDialog(false);
  };

  const expoStats = {
    total: expos.length,
    planning: expos.filter(e => e.status === 'planning').length,
    active: expos.filter(e => e.status === 'active').length,
    completed: expos.filter(e => e.status === 'completed').length,
    upcoming: expos.filter(e => new Date(e.start_date) > new Date()).length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-crm-primary-text">Expo Management</h1>
          <p className="text-crm-secondary-text">Manage exhibitions and events across multiple venues</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="crm-button-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create Expo
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Total Expos</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{expoStats.total}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Planning</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{expoStats.planning}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Active</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{expoStats.active}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Completed</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{expoStats.completed}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Upcoming</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{expoStats.upcoming}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="crm-card">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-crm-secondary-text" />
                <Input
                  placeholder="Search expos..."
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
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Expos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExpos.map((expo) => (
          <Card key={expo.id} className="crm-card">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{expo.name}</CardTitle>
                  <CardDescription className="flex items-center space-x-1 mt-2">
                    <MapPin className="h-4 w-4" />
                    <span>{expo.location}</span>
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(expo.status)}>
                  {expo.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-crm-secondary-text">Start Date</p>
                  <p className="font-medium">{format(new Date(expo.start_date), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <p className="text-crm-secondary-text">End Date</p>
                  <p className="font-medium">{format(new Date(expo.end_date), 'MMM dd, yyyy')}</p>
                </div>
              </div>

              {expo.notes && (
                <div>
                  <p className="text-crm-secondary-text text-sm">Notes</p>
                  <p className="text-sm text-crm-primary-text mt-1">{expo.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-crm-border">
                <div className="text-xs text-crm-secondary-text">
                  Created {format(new Date(expo.created_at), 'MMM dd, yyyy')}
                </div>
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
                      Edit Expo
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Building2 className="mr-2 h-4 w-4" />
                      Manage Booths
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Users className="mr-2 h-4 w-4" />
                      View Clients
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Expo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Expo Dialog */}
      <CreateExpoDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateExpo}
      />
    </div>
  );
}