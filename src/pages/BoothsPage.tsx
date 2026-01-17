import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2,
  Store,
  MapPin,
  Ruler,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  XCircle
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
import { Booth } from '@/types';
import CreateBoothDialog from '@/components/booths/CreateBoothDialog';

// Mock data
const mockBooths: (Booth & { expo?: { name: string; location: string } })[] = [
  {
    id: '1',
    booth_code: 'A1-001',
    expo_id: '1',
    hall: 'Hall A',
    zone: 'Zone 1',
    size_sqm: 25,
    price_per_meter: 600,
    total_price: 15000,
    status: 'sold',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    expo: {
      name: 'Tech Expo 2024',
      location: 'Convention Center A'
    }
  },
  {
    id: '2',
    booth_code: 'A1-002',
    expo_id: '1',
    hall: 'Hall A',
    zone: 'Zone 1',
    size_sqm: 30,
    price_per_meter: 600,
    total_price: 18000,
    status: 'reserved',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    expo: {
      name: 'Tech Expo 2024',
      location: 'Convention Center A'
    }
  },
  {
    id: '3',
    booth_code: 'A2-001',
    expo_id: '1',
    hall: 'Hall A',
    zone: 'Zone 2',
    size_sqm: 20,
    price_per_meter: 550,
    total_price: 11000,
    status: 'available',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    expo: {
      name: 'Tech Expo 2024',
      location: 'Convention Center A'
    }
  },
  {
    id: '4',
    booth_code: 'B1-001',
    expo_id: '1',
    hall: 'Hall B',
    zone: 'Zone 1',
    size_sqm: 35,
    price_per_meter: 650,
    total_price: 22750,
    status: 'available',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    expo: {
      name: 'Tech Expo 2024',
      location: 'Convention Center A'
    }
  },
  {
    id: '5',
    booth_code: 'H1-001',
    expo_id: '2',
    hall: 'Main Hall',
    zone: 'Premium Zone',
    size_sqm: 40,
    price_per_meter: 700,
    total_price: 28000,
    status: 'available',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    expo: {
      name: 'Healthcare Summit 2024',
      location: 'Medical Center Hall'
    }
  }
];

const getStatusColor = (status: string) => {
  const colors = {
    available: 'bg-green-100 text-green-800',
    reserved: 'bg-yellow-100 text-yellow-800',
    sold: 'bg-blue-100 text-blue-800'
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'available':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'reserved':
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case 'sold':
      return <XCircle className="h-4 w-4 text-blue-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
};

export default function BoothsPage() {
  const [booths, setBooths] = useState(mockBooths);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expoFilter, setExpoFilter] = useState<string>('all');
  const [hallFilter, setHallFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const filteredBooths = booths.filter(booth => {
    const matchesSearch = booth.booth_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         booth.hall.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         booth.zone.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || booth.status === statusFilter;
    const matchesExpo = expoFilter === 'all' || booth.expo_id === expoFilter;
    const matchesHall = hallFilter === 'all' || booth.hall === hallFilter;
    
    return matchesSearch && matchesStatus && matchesExpo && matchesHall;
  });

  const handleCreateBooth = (boothData: any) => {
    const newBooth = {
      id: Date.now().toString(),
      ...boothData,
      total_price: boothData.size_sqm * boothData.price_per_meter,
      status: 'available' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setBooths([...booths, newBooth]);
    setShowCreateDialog(false);
  };

  // Calculate booth stats
  const boothStats = {
    total: booths.length,
    available: booths.filter(b => b.status === 'available').length,
    reserved: booths.filter(b => b.status === 'reserved').length,
    sold: booths.filter(b => b.status === 'sold').length,
    total_value: booths.reduce((sum, b) => sum + b.total_price, 0),
    avg_price: booths.length > 0 ? booths.reduce((sum, b) => sum + b.total_price, 0) / booths.length : 0
  };

  const uniqueExpos = Array.from(new Set(booths.map(b => ({ id: b.expo_id, name: b.expo?.name || 'Unknown' }))));
  const uniqueHalls = Array.from(new Set(booths.map(b => b.hall)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-crm-primary-text">Booth Management</h1>
          <p className="text-crm-secondary-text">Manage booth inventory, pricing, and availability</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="crm-button-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create Booth
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Total Booths</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{boothStats.total}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Available</p>
            <p className="text-2xl font-semibold text-green-600 font-tabular">{boothStats.available}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Reserved</p>
            <p className="text-2xl font-semibold text-yellow-600 font-tabular">{boothStats.reserved}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Sold</p>
            <p className="text-2xl font-semibold text-blue-600 font-tabular">{boothStats.sold}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Total Value</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">
              ${boothStats.total_value.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Avg Price</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">
              ${Math.round(boothStats.avg_price).toLocaleString()}
            </p>
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
                  placeholder="Search booths..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={expoFilter} onValueChange={setExpoFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by expo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Expos</SelectItem>
                {uniqueExpos.map((expo) => (
                  <SelectItem key={expo.id} value={expo.id}>
                    {expo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={hallFilter} onValueChange={setHallFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by hall" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Halls</SelectItem>
                {uniqueHalls.map((hall) => (
                  <SelectItem key={hall} value={hall}>
                    {hall}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Booths Table */}
      <Card className="crm-card">
        <CardHeader>
          <CardTitle>Booth Inventory</CardTitle>
          <CardDescription>
            {filteredBooths.length} booths found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booth Code</TableHead>
                <TableHead>Expo</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Price/m²</TableHead>
                <TableHead>Total Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBooths.map((booth) => (
                <TableRow key={booth.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Store className="h-4 w-4 text-crm-secondary-text" />
                      <div>
                        <p className="font-medium text-crm-primary-text">{booth.booth_code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{booth.expo?.name}</p>
                      <p className="text-xs text-crm-secondary-text">{booth.expo?.location}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4 text-crm-secondary-text" />
                      <div>
                        <p className="text-sm">{booth.hall}</p>
                        <p className="text-xs text-crm-secondary-text">{booth.zone}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Ruler className="h-4 w-4 text-crm-secondary-text" />
                      <span className="font-tabular">{booth.size_sqm} m²</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <DollarSign className="h-4 w-4 text-crm-secondary-text" />
                      <span className="font-tabular">{booth.price_per_meter}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <DollarSign className="h-4 w-4 text-crm-secondary-text" />
                      <span className="font-tabular font-medium">
                        {booth.total_price.toLocaleString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(booth.status)}
                      <Badge className={getStatusColor(booth.status)}>
                        {booth.status}
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
                          Edit Booth
                        </DropdownMenuItem>
                        {booth.status === 'available' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Clock className="mr-2 h-4 w-4" />
                              Mark as Reserved
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Mark as Sold
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Booth
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

      {/* Create Booth Dialog */}
      <CreateBoothDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateBooth}
      />
    </div>
  );
}