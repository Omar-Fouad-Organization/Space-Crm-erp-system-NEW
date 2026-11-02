import {all as apiAll,save as apiSave,remove as apiRemove,metadata as apiMetadata} from '@/services/laravelClient';
import {authorizeExport} from '@/crm/api';
import {api} from '@/crm/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { expoService } from "@/services/supabaseService";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Crown,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Star,
  Building2,
  DollarSign,
  Users,
  Target,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Download,
  RefreshCw,
  Globe,
  Trophy,
  Award,
  Zap
} from "lucide-react";

const Sponsorship = () => {
  const { toast } = useToast();
  const { formatAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState("all-tiers");
  const [expoFilter, setExpoFilter] = useState("all-expos");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [packages, setPackages] = useState<any[]>([]);
  const [expos, setExpos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);

  const [formData, setFormData] = useState({
    package_name: '',
    tier_level: '',
    price_egp: '',
    max_sponsors: '',
    benefits: '',
    visibility_level: '',
    marketing_materials: '',
    booth_allocation: '',
    additional_services: '',
    status: 'Active',
    expo_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async()=>{setLoading(true);try{const [expos,packages,deals]=await Promise.all([apiAll('exhibitions'),apiAll('sponsorship_packages'),apiAll('deals')]);setExpos(expos);setPackages(packages.map(p=>{const e=expos.find(x=>x.id===p.exhibition_id);return {...p,package_name:p.name,tier_level:p.tier_level||p.tier,price_egp:p.price,current_sponsors:deals.filter(d=>d.sponsorship_package_id===p.id&&d.stage==='closed_won').length,max_sponsors:p.max_sponsors||1,status:p.status||'Active',expo_id:p.exhibition_id,expo_name:e?.name||'',expo_number:e?.expo_number||'',expo_start_date:e?.start_date,expo_end_date:e?.end_date,expo_city:e?.city||'',benefits:Array.isArray(p.benefits)?p.benefits.join(', '):p.benefits};}));}catch(error){toast({title:'Load failed',description:(error as Error).message,variant:'destructive'});}finally{setLoading(false);}};

  const handleCreatePackage = async () => {
    try {
      if (!formData.expo_id) {
        toast({
          title: "Error",
          description: "Please select an exhibition",
          variant: "destructive",
        });
        return;
      }

      const packageData = {
        ...formData,
        price_egp: parseFloat(formData.price_egp) || 0,
        max_sponsors: parseInt(formData.max_sponsors) || 1,
        current_sponsors: 0
      };

      // In a real implementation, you'd call: await expoService.createSponsorshipPackage(formData.expo_id, packageData);
      await apiSave('sponsorship_packages',{...packageData,price:packageData.price_egp,tier:({Title:'platinum',Platinum:'platinum',Gold:'gold',Silver:'silver',Bronze:'bronze'} as any)[packageData.tier_level]||'gold',currency:'EGP'});

      toast({
        title: "Success",
        description: "Sponsorship package created successfully",
      });

      setShowCreateDialog(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error creating package:", error);
      toast({
        title: "Error",
        description: "Failed to create sponsorship package",
        variant: "destructive",
      });
    }
  };

  const handleEditPackage = async () => {
    try {
      if (!editingPackage) return;

      const packageData = {
        ...formData,
        price_egp: parseFloat(formData.price_egp) || 0,
        max_sponsors: parseInt(formData.max_sponsors) || 1
      };

      // In a real implementation, you'd call: await expoService.updateSponsorshipPackage(editingPackage.expo_id, editingPackage.id, packageData);
      await apiSave('sponsorship_packages',{...packageData,price:packageData.price_egp,tier:({Title:'platinum',Platinum:'platinum',Gold:'gold',Silver:'silver',Bronze:'bronze'} as any)[packageData.tier_level]||'gold'},editingPackage.id);

      toast({
        title: "Success",
        description: "Sponsorship package updated successfully",
      });

      setShowEditDialog(false);
      setEditingPackage(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error updating package:", error);
      toast({
        title: "Error",
        description: "Failed to update sponsorship package",
        variant: "destructive",
      });
    }
  };

  const handleDeletePackage = async (packageItem: any) => {
    if (!confirm('Are you sure you want to delete this sponsorship package?')) return;

    try {
      // In a real implementation, you'd call: await expoService.deleteSponsorshipPackage(packageItem.expo_id, packageItem.id);
      await apiRemove('sponsorship_packages',packageItem.id);

      toast({
        title: "Success",
        description: "Sponsorship package deleted successfully",
      });

      loadData();
    } catch (error) {
      console.error("Error deleting package:", error);
      toast({
        title: "Error",
        description: "Failed to delete sponsorship package",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      package_name: '',
      tier_level: '',
      price_egp: '',
      max_sponsors: '',
      benefits: '',
      visibility_level: '',
      marketing_materials: '',
      booth_allocation: '',
      additional_services: '',
      status: 'Active',
      expo_id: ''
    });
  };

  const openEditDialog = (packageItem: any) => {
    setEditingPackage(packageItem);
    setFormData({
      package_name: packageItem.package_name || '',
      tier_level: packageItem.tier_level || '',
      price_egp: packageItem.price_egp?.toString() || '',
      max_sponsors: packageItem.max_sponsors?.toString() || '',
      benefits: packageItem.benefits || '',
      visibility_level: packageItem.visibility_level || '',
      marketing_materials: packageItem.marketing_materials || '',
      booth_allocation: packageItem.booth_allocation || '',
      additional_services: packageItem.additional_services || '',
      status: packageItem.status || 'Active',
      expo_id: packageItem.expo_id || ''
    });
    setShowEditDialog(true);
  };

  const exportPackages = async () => {
    try {
      await authorizeExport('sponsorship_packages',filteredPackages.map(row=>row.id));
      const csvContent = [
        // CSV Header
        ['Package Name', 'Tier Level', 'Price (EGP)', 'Max Sponsors', 'Current Sponsors', 'Status', 'Exhibition', 'City'].join(','),
        // CSV Data
        ...filteredPackages.map(pkg => [
          `"${pkg.package_name || ''}"`,
          pkg.tier_level || '',
          pkg.price_egp || '',
          pkg.max_sponsors || '',
          pkg.current_sponsors || '',
          pkg.status || '',
          `"${pkg.expo_name || ''}"`,
          pkg.expo_city || ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `sponsorship_packages_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: "Sponsorship package data has been exported to CSV",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export sponsorship package data",
        variant: "destructive",
      });
    }
  };

  // Filter packages based on search and filters
  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = !searchTerm ||
      pkg.package_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.tier_level?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pkg.expo_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTier = tierFilter === "all-tiers" || pkg.tier_level === tierFilter;
    const matchesExpo = expoFilter === "all-expos" || pkg.expo_id === expoFilter;
    const matchesStatus = statusFilter === "all-status" || pkg.status === statusFilter;

    return matchesSearch && matchesTier && matchesExpo && matchesStatus;
  });

  // Calculate statistics
  const stats = {
    total: packages.length,
    title: packages.filter(p => p.tier_level === 'Title').length,
    platinum: packages.filter(p => p.tier_level === 'Platinum').length,
    gold: packages.filter(p => p.tier_level === 'Gold').length,
    silver: packages.filter(p => p.tier_level === 'Silver').length,
    bronze: packages.filter(p => p.tier_level === 'Bronze').length,
    active: packages.filter(p => p.status === 'Active').length,
    totalRevenue: packages.reduce((sum, pkg) => sum + (pkg.price_egp * pkg.current_sponsors || 0), 0),
    totalSponsors: packages.reduce((sum, pkg) => sum + (pkg.current_sponsors || 0), 0),
    availableSlots: packages.reduce((sum, pkg) => sum + ((pkg.max_sponsors || 0) - (pkg.current_sponsors || 0)), 0)
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Title': return <Crown className="h-3 w-3" />;
      case 'Platinum': return <Trophy className="h-3 w-3" />;
      case 'Gold': return <Award className="h-3 w-3" />;
      case 'Silver': return <Star className="h-3 w-3" />;
      case 'Bronze': return <Target className="h-3 w-3" />;
      case 'Supporting': return <Zap className="h-3 w-3" />;
      default: return <Building2 className="h-3 w-3" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Title': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Platinum': return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'Gold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Silver': return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'Bronze': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Supporting': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800 border-green-200';
      case 'Inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Full': return 'bg-red-100 text-red-800 border-red-200';
      case 'Draft': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold tracking-tight">
            <Crown className="inline-block h-8 w-8 mr-3 text-purple-600" />
            Sponsorship Packages
          </h1>

          <p className="text-muted-foreground mt-2">
            Manage sponsorship packages and partnership tiers
          </p>

        </div>

        <div className="flex items-center space-x-3">
          <Button onClick={() => loadData()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportPackages} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Package
          </Button>
        </div>

      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Packages
                </p>
                <p className="text-2xl font-bold">
                  {stats.total}
                </p>
              </div>
              <Trophy className="h-4 w-4 text-blue-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Active Packages
                </p>
                <p className="text-2xl font-bold">
                  {stats.active}
                </p>
              </div>
              <Zap className="h-4 w-4 text-green-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Sponsors
                </p>
                <p className="text-2xl font-bold">
                  {stats.totalSponsors}
                </p>
              </div>
              <Star className="h-4 w-4 text-purple-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Available Slots
                </p>
                <p className="text-2xl font-bold">
                  {stats.availableSlots}
                </p>
              </div>
              <AlertCircle className="h-4 w-4 text-orange-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold">
                  {formatAmount(stats.totalRevenue)}
                </p>
              </div>
              <Award className="h-4 w-4 text-green-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">

            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search packages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-tiers">All Tiers</SelectItem>
                  <SelectItem value="Title">Title</SelectItem>
                  <SelectItem value="Platinum">Platinum</SelectItem>
                  <SelectItem value="Gold">Gold</SelectItem>
                  <SelectItem value="Silver">Silver</SelectItem>
                  <SelectItem value="Bronze">Bronze</SelectItem>
                  <SelectItem value="Supporting">Supporting</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-status">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Full">Full</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                </SelectContent>
              </Select>
              <Select value={expoFilter} onValueChange={setExpoFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-expos">All Exhibitions</SelectItem>
                  {expos.map((expo) => (
                    <SelectItem key={expo.id} value={expo.id}>
                      {expo.expo_number} - {expo.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Packages List */}
      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading packages...</span>
            </div>
          </CardContent>
        </Card>
      ) : filteredPackages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {packages.length === 0 ? "No Packages Found" : "No Matching Packages"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {packages.length === 0
                ? "Sponsorship packages will appear here when created for exhibitions"
                : "Try adjusting your search criteria or filters"
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">

          {filteredPackages.map((pkg) => (
            <Card key={pkg.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6">

                  <div className="flex items-start justify-between mb-4">

                    <div className="flex items-center space-x-3">

                      <div className="flex flex-col space-y-2">
                        <Badge className={`w-fit ${getTierColor(pkg.tier_level)}`}>
                          {getTierIcon(pkg.tier_level)}
                          {pkg.tier_level}
                        </Badge>
                        <Badge className={`w-fit ${getStatusColor(pkg.status)}`}>
                          {pkg.status === 'Active' ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                          {pkg.status}
                        </Badge>
                      </div>

                    </div>

                    <h3 className="text-xl font-semibold mb-2">
                      {pkg.package_name}
                    </h3>

                    <p className="text-muted-foreground mb-4">
                      {pkg.benefits}
                    </p>

                  </div>

                  <div className="flex items-center justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(pkg)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Package
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeletePackage(pkg)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Package
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                </div>

                <div className="px-6 pb-6 space-y-4">

                  {/* Exhibition Info */}
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">

                    <Building2 className="h-4 w-4" />
                    <div>
                      <div className="font-medium">{pkg.expo_name}</div>
                      <div className="text-xs">{pkg.expo_number}</div>
                    </div>

                  </div>

                  {/* Package Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">

                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Package Price</div>
                        <div className="text-lg font-bold text-green-600">
                          {formatAmount(pkg.price_egp || 0)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Sponsors</div>
                        <div className="text-muted-foreground">
                          {pkg.current_sponsors || 0}/{pkg.max_sponsors || 0}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${((pkg.current_sponsors || 0) / (pkg.max_sponsors || 1)) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Additional Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">

                    <div className="flex items-center space-x-2">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Visibility Level</div>
                        <div className="text-muted-foreground">{pkg.visibility_level}</div>
                      </div>
                    </div>

                    {/* Exhibition Dates */}
                    {pkg.expo_start_date && (
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <div className="text-muted-foreground">
                          {formatDate(pkg.expo_start_date)} - {formatDate(pkg.expo_end_date)}
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* Additional Details */}
                {(pkg.marketing_materials || pkg.booth_allocation || pkg.additional_services) && (
                  <div className="px-6 pb-6 border-t border-gray-100">

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm pt-4">
                      {pkg.marketing_materials && (
                        <div>
                          <div className="font-medium text-gray-900 mb-1">
                            Marketing Materials:
                          </div>
                          <div className="text-muted-foreground">
                            {pkg.marketing_materials}
                          </div>
                        </div>
                      )}
                      {pkg.booth_allocation && (
                        <div>
                          <div className="font-medium text-gray-900 mb-1">
                            Booth Allocation:
                          </div>
                          <div className="text-muted-foreground">
                            {pkg.booth_allocation}
                          </div>
                        </div>
                      )}
                      {pkg.additional_services && (
                        <div>
                          <div className="font-medium text-gray-900 mb-1">
                            Additional Services:
                          </div>
                          <div className="text-muted-foreground">
                            {pkg.additional_services}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

      )}

      {/* Create Package Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Sponsorship Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">

            {/* Basic Information */}
            <div className="space-y-4">

              <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="package_name">Package Name *</Label>
                  <Input
                    id="package_name"
                    value={formData.package_name}
                    onChange={(e) => setFormData({...formData, package_name: e.target.value})}
                    placeholder="Enter package name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tier_level">Tier Level *</Label>
                  <Select value={formData.tier_level} onValueChange={(value) => setFormData({...formData, tier_level: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tier level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Title">Title</SelectItem>
                      <SelectItem value="Platinum">Platinum</SelectItem>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                      <SelectItem value="Bronze">Bronze</SelectItem>
                      <SelectItem value="Supporting">Supporting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price_egp">Price (EGP) *</Label>
                  <Input
                    id="price_egp"
                    type="number"
                    value={formData.price_egp}
                    onChange={(e) => setFormData({...formData, price_egp: e.target.value})}
                    placeholder="Enter package price"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_sponsors">Maximum Sponsors *</Label>
                  <Input
                    id="max_sponsors"
                    type="number"
                    value={formData.max_sponsors}
                    onChange={(e) => setFormData({...formData, max_sponsors: e.target.value})}
                    placeholder="Enter maximum sponsors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visibility_level">Visibility Level</Label>
                  <Select value={formData.visibility_level} onValueChange={(value) => setFormData({...formData, visibility_level: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select visibility level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Premium">Premium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="expo_id">Exhibition *</Label>
                  <Select value={formData.expo_id} onValueChange={(value) => setFormData({...formData, expo_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select exhibition" />
                    </SelectTrigger>
                    <SelectContent>
                      {expos.map((expo) => (
                        <SelectItem key={expo.id} value={expo.id}>
                          {expo.expo_number} - {expo.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>

            </div>

            {/* Package Details */}
            <div className="space-y-4">

              <h3 className="text-lg font-semibold border-b pb-2">Package Details</h3>

              <div className="space-y-4">

                <div className="space-y-2">
                  <Label htmlFor="benefits">Benefits *</Label>
                  <Textarea
                    id="benefits"
                    value={formData.benefits}
                    onChange={(e) => setFormData({...formData, benefits: e.target.value})}
                    placeholder="List the benefits included in this package"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="marketing_materials">Marketing Materials</Label>
                  <Textarea
                    id="marketing_materials"
                    value={formData.marketing_materials}
                    onChange={(e) => setFormData({...formData, marketing_materials: e.target.value})}
                    placeholder="Describe marketing materials and promotional opportunities"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="booth_allocation">Booth Allocation</Label>
                  <Textarea
                    id="booth_allocation"
                    value={formData.booth_allocation}
                    onChange={(e) => setFormData({...formData, booth_allocation: e.target.value})}
                    placeholder="Describe booth space allocation and specifications"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additional_services">Additional Services</Label>
                  <Textarea
                    id="additional_services"
                    value={formData.additional_services}
                    onChange={(e) => setFormData({...formData, additional_services: e.target.value})}
                    placeholder="List any additional services included"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {setShowCreateDialog(false); resetForm();}}>
              Cancel
            </Button>
            <Button onClick={handleCreatePackage}>
              Create Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Package Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Sponsorship Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">

            {/* Basic Information */}
            <div className="space-y-4">

              <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="edit_package_name">Package Name *</Label>
                  <Input
                    id="edit_package_name"
                    value={formData.package_name}
                    onChange={(e) => setFormData({...formData, package_name: e.target.value})}
                    placeholder="Enter package name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_tier_level">Tier Level *</Label>
                  <Select value={formData.tier_level} onValueChange={(value) => setFormData({...formData, tier_level: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tier level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Title">Title</SelectItem>
                      <SelectItem value="Platinum">Platinum</SelectItem>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                      <SelectItem value="Bronze">Bronze</SelectItem>
                      <SelectItem value="Supporting">Supporting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_price_egp">Price (EGP) *</Label>
                  <Input
                    id="edit_price_egp"
                    type="number"
                    value={formData.price_egp}
                    onChange={(e) => setFormData({...formData, price_egp: e.target.value})}
                    placeholder="Enter package price"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_max_sponsors">Maximum Sponsors *</Label>
                  <Input
                    id="edit_max_sponsors"
                    type="number"
                    value={formData.max_sponsors}
                    onChange={(e) => setFormData({...formData, max_sponsors: e.target.value})}
                    placeholder="Enter maximum sponsors"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_visibility_level">Visibility Level</Label>
                  <Select value={formData.visibility_level} onValueChange={(value) => setFormData({...formData, visibility_level: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select visibility level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Premium">Premium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>

            </div>

            {/* Package Details */}
            <div className="space-y-4">

              <h3 className="text-lg font-semibold border-b pb-2">Package Details</h3>

              <div className="space-y-4">

                <div className="space-y-2">
                  <Label htmlFor="edit_benefits">Benefits *</Label>
                  <Textarea
                    id="edit_benefits"
                    value={formData.benefits}
                    onChange={(e) => setFormData({...formData, benefits: e.target.value})}
                    placeholder="List the benefits included in this package"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_marketing_materials">Marketing Materials</Label>
                  <Textarea
                    id="edit_marketing_materials"
                    value={formData.marketing_materials}
                    onChange={(e) => setFormData({...formData, marketing_materials: e.target.value})}
                    placeholder="Describe marketing materials and promotional opportunities"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_booth_allocation">Booth Allocation</Label>
                  <Textarea
                    id="edit_booth_allocation"
                    value={formData.booth_allocation}
                    onChange={(e) => setFormData({...formData, booth_allocation: e.target.value})}
                    placeholder="Describe booth space allocation and specifications"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_additional_services">Additional Services</Label>
                  <Textarea
                    id="edit_additional_services"
                    value={formData.additional_services}
                    onChange={(e) => setFormData({...formData, additional_services: e.target.value})}
                    placeholder="List any additional services included"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {setShowEditDialog(false); setEditingPackage(null); resetForm();}}>
              Cancel
            </Button>
            <Button onClick={handleEditPackage}>
              Update Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sponsorship;
