import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar
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
import { Client } from '@/types';
import CreateClientDialog from '@/components/clients/CreateClientDialog';

// Mock data
const mockClients: Client[] = [
  {
    id: '1',
    type: 'exhibitor',
    company_name: 'TechCorp Solutions',
    contact_person: 'John Smith',
    email: 'john@techcorp.com',
    phone: '+1-555-0123',
    industry: 'Technology',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    created_by: '1'
  },
  {
    id: '2',
    type: 'sponsor',
    company_name: 'MedTech Industries',
    contact_person: 'Dr. Emily Chen',
    email: 'emily@medtech.com',
    phone: '+1-555-0456',
    industry: 'Healthcare',
    status: 'active',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    created_by: '1'
  },
  {
    id: '3',
    type: 'sector_sponsor',
    company_name: 'EcoSolutions Ltd',
    contact_person: 'Sarah Green',
    email: 'sarah@ecosolutions.com',
    phone: '+1-555-0789',
    industry: 'Environmental',
    status: 'active',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    created_by: '1'
  }
];

const getClientTypeColor = (type: string) => {
  const colors = {
    exhibitor: 'bg-blue-100 text-blue-800',
    sponsor: 'bg-green-100 text-green-800',
    sector_sponsor: 'bg-purple-100 text-purple-800'
  };
  return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.contact_person.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || client.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleCreateClient = (clientData: any) => {
    const newClient: Client = {
      id: Date.now().toString(),
      ...clientData,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: '1'
    };
    setClients([...clients, newClient]);
    setShowCreateDialog(false);
  };

  const clientStats = {
    total: clients.length,
    exhibitors: clients.filter(c => c.type === 'exhibitor').length,
    sponsors: clients.filter(c => c.type === 'sponsor').length,
    sector_sponsors: clients.filter(c => c.type === 'sector_sponsor').length,
    active: clients.filter(c => c.status === 'active').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-crm-primary-text">Client Management</h1>
          <p className="text-crm-secondary-text">Manage exhibitors, sponsors, and sector sponsors</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="crm-button-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create Client
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Total Clients</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{clientStats.total}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Exhibitors</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{clientStats.exhibitors}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Sponsors</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{clientStats.sponsors}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Sector Sponsors</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{clientStats.sector_sponsors}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Active</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{clientStats.active}</p>
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
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="exhibitor">Exhibitor</SelectItem>
                <SelectItem value="sponsor">Sponsor</SelectItem>
                <SelectItem value="sector_sponsor">Sector Sponsor</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card className="crm-card">
        <CardHeader>
          <CardTitle>All Clients</CardTitle>
          <CardDescription>
            {filteredClients.length} clients found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-crm-secondary-text" />
                      <div>
                        <p className="font-medium text-crm-primary-text">{client.company_name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-crm-secondary-text" />
                      <span>{client.contact_person}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getClientTypeColor(client.type)}>
                      {client.type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{client.industry}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1 text-sm">
                        <Mail className="h-3 w-3 text-crm-secondary-text" />
                        <span>{client.email}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-sm">
                        <Phone className="h-3 w-3 text-crm-secondary-text" />
                        <span>{client.phone}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                      {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4 text-crm-secondary-text" />
                      <span className="text-sm">
                        {new Date(client.created_at).toLocaleDateString()}
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
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Client
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Client
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

      {/* Create Client Dialog */}
      <CreateClientDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateClient}
      />
    </div>
  );
}