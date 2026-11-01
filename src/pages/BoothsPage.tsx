import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { boothService, type Booth } from '@/services/supabaseService';
import { CreateBoothDialog } from '@/components/forms/CreateBoothDialog';
import { EditBoothDialog } from '@/components/forms/EditBoothDialog';
import ModernDeleteButton from '@/components/ui/ModernDeleteButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  MapPin,
  DollarSign,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Edit,
  Trash2,
  Download,
  RefreshCw,
  Ruler,
  Target,
  Globe,
  Zap,
  Activity,
  XCircle,
  AlertCircle,
  Grid3X3,
  List,
  Crown,
  TrendingUp,
  BarChart3
} from 'lucide-react';

const Booths = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [typeFilter, setTypeFilter] = useState("all-types");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [actionsDialogOpen, setActionsDialogOpen] = useState(false);
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);

  useEffect(() => {
    loadBooths();
  }, []);

  const loadBooths = async () => {
    try {
      setLoading(true);
      console.log('🏢 Booths: Loading booths from database...');
      const data = await boothService.getAll();
      console.log('✅ Booths: Loaded booths:', data?.length, data);

      if (!data || data.length === 0) {
        console.log('📝 Booths: No booths found in database, showing empty state');
        setBooths([]);
        return;
      }

      console.log('✅ Booths: Set booths data:', data);
      setBooths(data);
    } catch (error) {
      console.error("🚨 Booths: Error loading booths:", error);
      toast({
        title: "Error Loading Booths",
        description: "Failed to load booths from database. Please try refreshing the page.",
        variant: "destructive",
      });
      setBooths([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBooth = async (boothId: string) => {
    try {
      console.log('🗑️ Booths: Deleting booth with ID:', boothId);

      // Remove from local state immediately for better UX
      const originalBooths = booths;
      setBooths(prevBooths => prevBooths.filter(booth => booth.id !== boothId));

      // Try to delete from backend database
      await boothService.delete(boothId);
      console.log('✅ Booths: Delete successful');

      toast({
        title: "Booth Deleted",
        description: "Booth has been permanently removed from the system",
      });

      // Trigger expo booth count refresh if function is available
      if ((window as any).refreshExpoBoothCounts) {
        console.log('🔄 Triggering expo booth count refresh after booth deletion');
        (window as any).refreshExpoBoothCounts();
      }

      // Force reload to ensure consistency
      setTimeout(() => {
        loadBooths();
      }, 1000);
    } catch (error: any) {
      console.error('🚨 Booths: Error deleting booth:', error);
      // Restore original state on error
      setBooths(booths);
      toast({
        title: "Error",
        description: error.message || "Failed to delete booth",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (boothId: string, newStatus: string) => {
    try {
      console.log('🔄 Booths: Updating booth status:', boothId, newStatus);

      // Update local state immediately
      setBooths(prevBooths =>
        prevBooths.map(booth =>
          booth.id === boothId ? { ...booth, status: newStatus } : booth
        )
      );

      // Update in database
      await boothService.updateStatus(boothId, newStatus);

      toast({
        title: "Status Updated",
        description: `Booth status changed to ${newStatus}`,
      });
    } catch (error: any) {
      console.error('🚨 Booths: Error updating status:', error);
      // Reload to restore correct state
      loadBooths();
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleEditBooth = (booth: Booth) => {
    setSelectedBooth(booth);
    setEditDialogOpen(true);
    setActionsDialogOpen(false);
  };

  const handleOpenActions = (booth: Booth) => {
    setSelectedBooth(booth);
    setActionsDialogOpen(true);
  };

  const exportBooths = () => {
    try {
      const csvContent = [
        // CSV Header
        ['Booth Number', 'Booth Code', 'Exhibition', 'Hall', 'Zone', 'Size (sqm)', 'Type', 'Status', 'Total Price', 'Assigned Company'].join(','),
        // CSV Data
        ...filteredBooths.map(booth => [
          booth.booth_number || '',
          booth.booth_code || '',
          `"${booth.expo_name || ''}"`,
          booth.hall || '',
          booth.zone || '',
          booth.size_sqm || '',
          booth.booth_type || '',
          booth.status || '',
          booth.total_price || '',
          `"${booth.assigned_to_company || ''}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `booths_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: "Booth data has been exported to CSV",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export booth data",
        variant: "destructive",
      });
    }
  };

  // Filter booths based on search and filters
  const filteredBooths = booths.filter(booth => {
    const matchesSearch = !searchTerm ||
      booth.booth_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booth.booth_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booth.expo_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booth.hall?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booth.zone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booth.assigned_to_company?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all-status" || booth.status === statusFilter;
    const matchesType = typeFilter === "all-types" || booth.booth_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate statistics
  const stats = {
    total: booths.length,
    available: booths.filter(b => b.status === 'Available').length,
    booked: booths.filter(b => b.status === 'Booked').length,
    reserved: booths.filter(b => b.status === 'Reserved').length,
    occupied: booths.filter(b => b.status === 'Occupied').length,
    maintenance: booths.filter(b => b.status === 'Maintenance').length,
    totalArea: booths.reduce((sum, booth) => sum + (booth.size_sqm || 0), 0),
    totalRevenue: booths.reduce((sum, booth) => sum + (booth.total_price || 0), 0)
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Available': return <CheckCircle className="h-4 w-4" />;
      case 'Booked': return <Target className="h-4 w-4" />;
      case 'Reserved': return <Clock className="h-4 w-4" />;
      case 'Occupied': return <Users className="h-4 w-4" />;
      case 'Maintenance': return <AlertTriangle className="h-4 w-4" />;
      case 'Unavailable': return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-green-100 text-green-800 border-green-200';
      case 'Booked': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Reserved': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Occupied': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Maintenance': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Unavailable': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Premium': return <Crown className="h-4 w-4" />;
      case 'Corner': return <Target className="h-4 w-4" />;
      case 'Island': return <Globe className="h-4 w-4" />;
      case 'Peninsula': return <MapPin className="h-4 w-4" />;
      default: return <Building2 className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">

      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">

          <div>

            <h1 className="text-3xl font-bold text-gray-900">
              <Building2 className="inline-block h-8 w-8 mr-3 text-blue-600" />
              Booth Management
            </h1>

            <p className="text-gray-600 mt-1">
              Manage exhibition booths, assignments, and availability
            </p>

          </div>

          <div className="flex items-center space-x-3">

            <Button onClick={() => loadBooths()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={exportBooths} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Booth
            </Button>

          </div>

        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card>
            <CardContent className="p-4 text-center">

              <div className="flex items-center justify-center mb-2">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>

              <div className="text-sm text-gray-500 mb-1">
                Total Booths
              </div>

              <div className="text-2xl font-bold text-gray-900">
                {stats.total}
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">

              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>

              <div className="text-sm text-gray-500 mb-1">
                Available
              </div>

              <div className="text-2xl font-bold text-gray-900">
                {stats.available}
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">

              <div className="flex items-center justify-center mb-2">
                <Target className="h-5 w-5 text-blue-600" />
              </div>

              <div className="text-sm text-gray-500 mb-1">
                Booked
              </div>

              <div className="text-2xl font-bold text-gray-900">
                {stats.booked}
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">

              <div className="flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>

              <div className="text-sm text-gray-500 mb-1">
                Reserved
              </div>

              <div className="text-2xl font-bold text-gray-900">
                {stats.reserved}
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">

              <div className="flex items-center justify-center mb-2">
                <Users className="h-5 w-5 text-purple-600" />
              </div>

              <div className="text-sm text-gray-500 mb-1">
                Occupied
              </div>

              <div className="text-2xl font-bold text-gray-900">
                {stats.occupied}
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">

              <div className="flex items-center justify-center mb-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>

              <div className="text-sm text-gray-500 mb-1">
                Maintenance
              </div>

              <div className="text-2xl font-bold text-gray-900">
                {stats.maintenance}
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">

              <div className="flex items-center justify-center mb-2">
                <Ruler className="h-5 w-5 text-indigo-600" />
              </div>

              <div className="text-sm text-gray-500 mb-1">
                Total Area
              </div>

              <div className="text-2xl font-bold text-gray-900">
                {stats.totalArea.toLocaleString()}
              </div>

              <div className="text-xs text-gray-500">
                sqm
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">

              <div className="flex items-center justify-center mb-2">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>

              <div className="text-sm text-gray-500 mb-1">
                Total Revenue
              </div>

              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.totalRevenue)}
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>

          <CardContent className="p-6">

            <div className="flex flex-col md:flex-row gap-4">

              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search booths by code, number, exhibition, location, or company..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3">

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-status">All Status</SelectItem>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Reserved">Reserved</SelectItem>
                    <SelectItem value="Booked">Booked</SelectItem>
                    <SelectItem value="Occupied">Occupied</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Unavailable">Unavailable</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-types">All Types</SelectItem>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                    <SelectItem value="Corner">Corner</SelectItem>
                    <SelectItem value="Island">Island</SelectItem>
                    <SelectItem value="Peninsula">Peninsula</SelectItem>
                    <SelectItem value="Inline">Inline</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center space-x-2">

                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>

                </div>

              </div>

            </div>

          </CardContent>

        </Card>

        {/* Booths List */}
        {loading ? (
          <Card>

            <CardContent className="p-12 text-center">

              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                Loading booths...
              </p>

            </CardContent>

          </Card>

        ) : filteredBooths.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">

              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />

              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {booths.length === 0 ? "No Booths Found" : "No Matching Booths"}
              </h3>

              <p className="text-gray-600 mb-6">
                {booths.length === 0
                  ? "Create your first booth to get started with booth management"
                  : "Try adjusting your search criteria or filters"
                }
              </p>

              {booths.length === 0 && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Booth
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {filteredBooths.map((booth) => (
              <Card key={booth.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">

                    <div className="flex items-center space-x-3">

                      <div className="p-2 bg-blue-100 rounded-lg">

                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>

                      <div className="flex-1 min-w-0">

                        <h3 className="font-semibold text-lg text-gray-900 truncate">
                          {booth.booth_number}
                        </h3>

                        <Badge className={`${getStatusColor(booth.status)} flex items-center gap-1 mt-1`}>
                          {getStatusIcon(booth.status)}
                          {booth.status}
                        </Badge>
                      </div>

                    </div>

                    <div className="flex items-center space-x-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenActions(booth)}
                            className="hover:bg-gray-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="mt-2">

                    <p className="text-sm font-medium text-gray-900">
                      {booth.booth_code}
                    </p>

                    {booth.expo_name && (
                      <p className="text-xs text-gray-500 mt-1">
                        {booth.expo_name}
                      </p>
                    )}
                  </div>

                </CardHeader>
                <CardContent className="pt-0">

                  {/* Location Info */}
                  <div className="flex items-center text-sm text-gray-600 mb-3">
                    <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                    <div className="flex-1">

                      <p className="font-medium">
                        {booth.hall && booth.zone ? `${booth.hall} - ${booth.zone}` : booth.hall || booth.zone || 'Location not set'}
                      </p>

                      {booth.aisle && <p className="text-xs text-gray-500">Aisle: {booth.aisle}</p>}
                    </div>

                  </div>

                  {/* Booth Type and Size */}
                  <div className="grid grid-cols-2 gap-4 mb-3">

                    <div className="flex items-center text-sm">

                      {getTypeIcon(booth.booth_type)}
                      <div className="ml-2">

                        <p className="text-xs text-gray-500">
                          Type
                        </p>

                        <p className="font-medium text-gray-900">
                          {booth.booth_type}
                        </p>

                      </div>

                    </div>

                    <div className="flex items-center text-sm">

                      <Ruler className="h-4 w-4 text-gray-400" />
                      <div className="ml-2">

                        <p className="text-xs text-gray-500">
                          Size
                        </p>

                        <p className="font-medium text-gray-900">
                          {booth.size_sqm} sqm
                        </p>

                      </div>

                    </div>

                  </div>

                  {/* Pricing */}
                  {booth.total_price > 0 && (
                    <div className="flex items-center justify-between text-sm mb-3">

                      <span className="text-gray-600">Total Price:</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(booth.total_price, booth.currency)}
                      </span>
                    </div>

                  )}

                  {/* Assignment Info */}
                  {booth.assigned_to_company && (
                    <div className="flex items-start text-sm mb-3">

                      <Users className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                      <div className="flex-1 min-w-0">

                        <p className="text-xs text-gray-500">
                          Assigned to:
                        </p>

                        <p className="font-medium text-gray-900 truncate">
                          {booth.assigned_to_company}
                        </p>

                        {booth.assigned_to_contact && (
                          <p className="text-xs text-gray-500 truncate">{booth.assigned_to_contact}</p>
                        )}
                      </div>

                    </div>

                  )}

                  {/* Features */}
                  {booth.features && booth.features.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">

                      {booth.features.slice(0, 3).map((feature: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                      {booth.features.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{booth.features.length - 3} more
                        </Badge>
                      )}
                    </div>

                  )}
                </CardContent>

                {/* Card Footer with Actions */}
                <div className="px-6 pb-4 pt-2 border-t bg-gray-50">

                  <div className="flex items-center justify-between">

                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/booths/${booth.id}`)}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedBooth(booth);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedBooth(booth);
                          setActionsDialogOpen(true);
                        }}>
                          <Zap className="h-4 w-4 mr-2" />
                          Quick Actions
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteBooth(booth.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                </div>

              </Card>
            ))}
          </div>

        )}

        {/* Dialogs */}
        <CreateBoothDialog
          isOpen={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onSuccess={loadBooths}
        />

        <EditBoothDialog
          isOpen={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          onSuccess={loadBooths}
          booth={selectedBooth}
        />

        {/* Actions Dialog */}
        <Dialog open={actionsDialogOpen} onOpenChange={setActionsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Zap className="h-5 w-5 mr-2" />
                Booth Actions: {selectedBooth?.booth_code}
              </DialogTitle>
            </DialogHeader>

            {selectedBooth && (
              <div className="space-y-6">

                {/* Quick Actions */}
                <div>

                  <h4 className="font-medium mb-3">Quick Actions</h4>

                  <div className="space-y-2">

                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        navigate(`/booths/${selectedBooth.id}`);
                        setActionsDialogOpen(false);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleEditBooth(selectedBooth)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Booth
                    </Button>

                  </div>

                </div>

                {/* Quick Status Changes */}
                {(selectedBooth.status === 'Available' || selectedBooth.status === 'Reserved') && (
                  <div>

                    <h4 className="font-medium mb-3">Quick Status Changes</h4>

                    <div className="space-y-2">

                      {selectedBooth.status === 'Available' && (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            handleStatusChange(selectedBooth.id, 'Reserved');
                            setActionsDialogOpen(false);
                          }}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Mark Reserved
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          handleStatusChange(selectedBooth.id, 'Booked');
                          setActionsDialogOpen(false);
                        }}
                      >
                        <Target className="h-4 w-4 mr-2" />
                        Mark Booked
                      </Button>

                    </div>

                  </div>

                )}

                {/* All Status Options */}
                <div>

                  <h4 className="font-medium mb-3">Change Status</h4>

                  <div className="grid grid-cols-2 gap-2">

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleStatusChange(selectedBooth.id, 'Available');
                        setActionsDialogOpen(false);
                      }}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Available
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleStatusChange(selectedBooth.id, 'Reserved');
                        setActionsDialogOpen(false);
                      }}
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      Reserved
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleStatusChange(selectedBooth.id, 'Booked');
                        setActionsDialogOpen(false);
                      }}
                    >
                      <Target className="h-3 w-3 mr-1" />
                      Booked
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleStatusChange(selectedBooth.id, 'Occupied');
                        setActionsDialogOpen(false);
                      }}
                    >
                      <Users className="h-3 w-3 mr-1" />
                      Occupied
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleStatusChange(selectedBooth.id, 'Maintenance');
                        setActionsDialogOpen(false);
                      }}
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Maintenance
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleStatusChange(selectedBooth.id, 'Unavailable');
                        setActionsDialogOpen(false);
                      }}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Unavailable
                    </Button>

                  </div>

                </div>

                {/* Danger Zone */}
                <div>

                  <h4 className="font-medium mb-3 text-red-600">Danger Zone</h4>

                  <ModernDeleteButton
                    onDelete={async () => {
                      await handleDeleteBooth(selectedBooth.id);
                      setActionsDialogOpen(false);
                    }}
                    variant="destructive"
                    title="Delete Booth"
                    itemName={`${selectedBooth.booth_code || selectedBooth.booth_number || 'Booth'}`}
                    itemDetails={
                      <div className="space-y-1 text-sm">

                        <div>Booth Code: {selectedBooth.booth_code}</div>

                        <div>Exhibition: {selectedBooth.expo_name}</div>

                        <div>Size: {selectedBooth.size_sqm} sqm</div>

                        <div>Type: {selectedBooth.booth_type}</div>

                        <div>Status: {selectedBooth.status}</div>

                        {selectedBooth.assigned_to_company && (
                          <div>Assigned to: {selectedBooth.assigned_to_company}</div>
                        )}
                        <div className="text-red-600 font-medium mt-2">
                          Warning: This will permanently delete the booth and all associated data
                        </div>

                      </div>

                    }
                    dangerLevel="high"
                    className="w-full"
                    confirmationText="All booth assignments and booking history will be permanently lost."
                  />
                </div>

              </div>

            )}
          </DialogContent>
        </Dialog>

        {/* Create Booth Dialog */}
        <CreateBoothDialog
          isOpen={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onSuccess={() => {
            setCreateDialogOpen(false);
            loadBooths(); // Refresh booth list

            // Trigger expo booth count refresh if function is available
            if ((window as any).refreshExpoBoothCounts) {
              console.log('🔄 Triggering expo booth count refresh after booth creation');
              (window as any).refreshExpoBoothCounts();
            }

            toast({
              title: "Booth Created",
              description: "New booth has been created and expo booth counts updated",
            });
          }}
        />

        {/* Edit Booth Dialog */}
        {selectedBooth && (
          <EditBoothDialog
            isOpen={editDialogOpen}
            onClose={() => {
              setEditDialogOpen(false);
              setSelectedBooth(null);
            }}
            onSuccess={() => {
              setEditDialogOpen(false);
              setSelectedBooth(null);
              loadBooths(); // Refresh booth list

              // Trigger expo booth count refresh if function is available
              if ((window as any).refreshExpoBoothCounts) {
                console.log("🔄 Triggering expo booth count refresh after booth update");
                (window as any).refreshExpoBoothCounts();
              }
            }}
            booth={selectedBooth}
          />
        )}
      </div>

    </div>

  );
};

export default Booths;