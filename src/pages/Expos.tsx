import {WorkflowLinks} from '@/components/workspace/WorkflowLinks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Globe,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  MapPin,
  Users,
  User,
  DollarSign,
  Building2,
  Trophy,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Download,
  TrendingUp,
  Activity,
  Play,
  Send,
  CheckCircle2,
  XCircle,
  Pause,
  BarChart3,
  Target,
  Zap,
  Star,
  Award,
  Briefcase,
  FileText,
  Share2,
  ExternalLink,
  Loader2,
  ArrowRight,
  TrendingDown,
  PieChart
} from "lucide-react";

interface Expo {
  id: string;
  expo_number: string;
  name: string;
  description?: string;
  theme?: string;
  start_date: string;
  end_date: string;
  city?: string;
  country?: string;
  venue_name?: string;
  status: string;
  priority: string;
  expected_visitors?: number;
  booth_count?: number;
  budget?: number;
  manager_name?: string;
  organizer_name?: string;
  website_url?: string;
  tags?: string[];
  totalExhibitors?: number;
  paidExhibitors?: number;
  totalSponsors?: number;
  totalRevenue?: number;
  occupancyRate?: number;
  created_at: string;
  updated_at: string;
}

interface ExpoStats {
  total: number;
  active: number;
  planning: number;
  completed: number;
  registration: number;
  cancelled: number;
  totalRevenue: number;
  totalVisitors: number;
}

const Expos = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [priorityFilter, setPriorityFilter] = useState("all-priority");
  const [yearFilter, setYearFilter] = useState("all-years");
  const [expos, setExpos] = useState<Expo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingExpo, setEditingExpo] = useState<Expo | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [expoToDelete, setExpoToDelete] = useState<Expo | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  // Form states for create/edit
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    theme: '',
    start_date: '',
    end_date: '',
    city: '',
    country: '',
    venue_name: '',
    status: 'Planning',
    priority: 'Medium',
    expected_visitors: '',
    booth_count: '',
    budget: '',
    manager_name: '',
    organizer_name: '',
    website_url: '',
    tags: ''
  });

  useEffect(() => {
    loadExpos();
  }, []);

  // Function to refresh booth counts for all expos
  const refreshBoothCounts = async () => {
    console.log('🔄 Refreshing booth counts for all exhibitions...');
    await loadExpos();
  };

  // Expose refresh function globally for booth management
  useEffect(() => {
    (window as any).refreshExpoBoothCounts = refreshBoothCounts;
    return () => {
      delete (window as any).refreshExpoBoothCounts;
    };
  }, []);

  const loadExpos = async () => {
    try {
      setLoading(true);

      // Load exhibitions from database
      const { data: exhibitions, error } = await supabase
        .from('exhibitions_2026_01_11_15_00')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading exhibitions:', error);
        throw error;
      }

      // Get booth counts for each exhibition
      const exhibitionsWithBoothCounts = await Promise.all(
        (exhibitions || []).map(async (exhibition) => {
          try {
            // Count booths assigned to this exhibition
            const { count: boothCount, error: boothError } = await supabase
              .from('booths_2026_01_10_12_00')
              .select('*', { count: 'exact', head: true })
              .eq('exhibition_id', exhibition.id);

            if (boothError) {
              console.warn('Error counting booths for exhibition:', exhibition.id, boothError);
              return { ...exhibition, actual_booth_count: 0 };
            }

            return { ...exhibition, actual_booth_count: boothCount || 0 };
          } catch (error) {
            console.warn('Error processing booth count for exhibition:', exhibition.id, error);
            return { ...exhibition, actual_booth_count: 0 };
          }
        })
      );

      // Transform database data to match Expo interface with actual booth counts
      const transformedExpos: Expo[] = exhibitionsWithBoothCounts.map(exhibition => ({
        id: exhibition.id,
        expo_number: exhibition.expo_number,
        name: exhibition.name,
        description: exhibition.description,
        theme: exhibition.theme,
        start_date: exhibition.start_date,
        end_date: exhibition.end_date,
        city: exhibition.city,
        country: exhibition.country,
        venue_name: exhibition.venue_name,
        status: exhibition.status,
        priority: exhibition.priority,
        expected_visitors: exhibition.expected_visitors,
        booth_count: exhibition.actual_booth_count, // Use actual count from database
        budget: exhibition.budget,
        manager_name: exhibition.manager_name,
        organizer_name: exhibition.organizer_name,
        website_url: exhibition.website_url,
        tags: exhibition.tags || [],
        totalExhibitors: exhibition.total_exhibitors || 0,
        paidExhibitors: exhibition.paid_exhibitors || 0,
        totalSponsors: exhibition.total_sponsors || 0,
        totalRevenue: exhibition.total_revenue || 0,
        occupancyRate: exhibition.occupancy_rate || 0,
        created_at: exhibition.created_at,
        updated_at: exhibition.updated_at
      }));

      setExpos(transformedExpos);

    } catch (error: any) {
      console.error("Error loading expos:", error);
      toast({
        title: "Error Loading Exhibitions",
        description: "Failed to load exhibitions from database. Please try refreshing the page.",
        variant: "destructive",
      });
      setExpos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpo = async () => {
    try {
      // Prepare data for database insertion
      const exhibitionData = {
        expo_number: `EXPO-2026-${String(expos.length + 1).padStart(3, '0')}`,
        name: formData.name,
        description: formData.description,
        theme: formData.theme,
        start_date: formData.start_date,
        end_date: formData.end_date,
        city: formData.city,
        country: formData.country,
        venue_name: formData.venue_name,
        status: formData.status,
        priority: formData.priority,
        expected_visitors: formData.expected_visitors ? parseInt(formData.expected_visitors) : null,
        booth_count: formData.booth_count ? parseInt(formData.booth_count) : null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        manager_name: formData.manager_name,
        organizer_name: formData.organizer_name,
        website_url: formData.website_url,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
        total_exhibitors: 0,
        paid_exhibitors: 0,
        total_sponsors: 0,
        total_revenue: 0,
        occupancy_rate: 0
      };

      // Insert into database
      const { data: newExhibition, error } = await supabase
        .from('exhibitions_2026_01_11_15_00')
        .insert([exhibitionData])
        .select()
        .single();

      if (error) {
        console.error('Error creating exhibition:', error);
        throw error;
      }

      // Transform and add to local state
      const newExpo: Expo = {
        id: newExhibition.id,
        expo_number: newExhibition.expo_number,
        name: newExhibition.name,
        description: newExhibition.description,
        theme: newExhibition.theme,
        start_date: newExhibition.start_date,
        end_date: newExhibition.end_date,
        city: newExhibition.city,
        country: newExhibition.country,
        venue_name: newExhibition.venue_name,
        status: newExhibition.status,
        priority: newExhibition.priority,
        expected_visitors: newExhibition.expected_visitors,
        booth_count: newExhibition.booth_count,
        budget: newExhibition.budget,
        manager_name: newExhibition.manager_name,
        organizer_name: newExhibition.organizer_name,
        website_url: newExhibition.website_url,
        tags: newExhibition.tags || [],
        totalExhibitors: newExhibition.total_exhibitors || 0,
        paidExhibitors: newExhibition.paid_exhibitors || 0,
        totalSponsors: newExhibition.total_sponsors || 0,
        totalRevenue: newExhibition.total_revenue || 0,
        occupancyRate: newExhibition.occupancy_rate || 0,
        created_at: newExhibition.created_at,
        updated_at: newExhibition.updated_at
      };

      setExpos(prev => [newExpo, ...prev]);
      setShowCreateDialog(false);
      resetForm();

      toast({
        title: "Exhibition Created",
        description: `Exhibition "${formData.name}" has been created successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create exhibition",
        variant: "destructive",
      });
    }
  };

  const handleUpdateExpo = async () => {
    if (!editingExpo) return;

    try {
      // Prepare data for database update
      const updateData = {
        name: formData.name,
        description: formData.description,
        theme: formData.theme,
        start_date: formData.start_date,
        end_date: formData.end_date,
        city: formData.city,
        country: formData.country,
        venue_name: formData.venue_name,
        status: formData.status,
        priority: formData.priority,
        expected_visitors: formData.expected_visitors ? parseInt(formData.expected_visitors) : null,
        booth_count: formData.booth_count ? parseInt(formData.booth_count) : null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        manager_name: formData.manager_name,
        organizer_name: formData.organizer_name,
        website_url: formData.website_url,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : []
      };

      // Update in database
      const { data: updatedExhibition, error } = await supabase
        .from('exhibitions_2026_01_11_15_00')
        .update(updateData)
        .eq('id', editingExpo.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating exhibition:', error);
        throw error;
      }

      // Transform and update local state
      const updatedExpo: Expo = {
        id: updatedExhibition.id,
        expo_number: updatedExhibition.expo_number,
        name: updatedExhibition.name,
        description: updatedExhibition.description,
        theme: updatedExhibition.theme,
        start_date: updatedExhibition.start_date,
        end_date: updatedExhibition.end_date,
        city: updatedExhibition.city,
        country: updatedExhibition.country,
        venue_name: updatedExhibition.venue_name,
        status: updatedExhibition.status,
        priority: updatedExhibition.priority,
        expected_visitors: updatedExhibition.expected_visitors,
        booth_count: updatedExhibition.booth_count,
        budget: updatedExhibition.budget,
        manager_name: updatedExhibition.manager_name,
        organizer_name: updatedExhibition.organizer_name,
        website_url: updatedExhibition.website_url,
        tags: updatedExhibition.tags || [],
        totalExhibitors: updatedExhibition.total_exhibitors || 0,
        paidExhibitors: updatedExhibition.paid_exhibitors || 0,
        totalSponsors: updatedExhibition.total_sponsors || 0,
        totalRevenue: updatedExhibition.total_revenue || 0,
        occupancyRate: updatedExhibition.occupancy_rate || 0,
        created_at: updatedExhibition.created_at,
        updated_at: updatedExhibition.updated_at
      };

      setExpos(prev => prev.map(expo =>
        expo.id === editingExpo.id ? updatedExpo : expo
      ));

      setShowEditDialog(false);
      setEditingExpo(null);
      resetForm();

      toast({
        title: "Exhibition Updated",
        description: `Exhibition "${formData.name}" has been updated successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update exhibition",
        variant: "destructive",
      });
    }
  };

  const handleDeleteExpo = (expo: Expo) => {
    setExpoToDelete(expo);
    setShowDeleteDialog(true);
  };

  const confirmDeleteExpo = async () => {
    if (!expoToDelete) return;

    try {
      // Delete from database
      const { error } = await supabase
        .from('exhibitions_2026_01_11_15_00')
        .delete()
        .eq('id', expoToDelete.id);

      if (error) {
        console.error('Error deleting exhibition:', error);
        throw error;
      }

      // Update local state
      setExpos(prev => prev.filter(expo => expo.id !== expoToDelete.id));

      toast({
        title: "Exhibition Deleted",
        description: `Exhibition "${expoToDelete.name}" has been deleted successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete exhibition",
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
      setExpoToDelete(null);
    }
  };

  const handleStatusChange = async (expoId: string, newStatus: string) => {
    try {
      // Update status in database
      const { error } = await supabase
        .from('exhibitions_2026_01_11_15_00')
        .update({ status: newStatus })
        .eq('id', expoId);

      if (error) {
        console.error('Error updating exhibition status:', error);
        throw error;
      }

      // Update local state
      setExpos(prevExpos =>
        prevExpos.map(expo =>
          expo.id === expoId ? { ...expo, status: newStatus, updated_at: new Date().toISOString() } : expo
        )
      );

      toast({
        title: "Status Updated",
        description: `Exhibition status changed to ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleEditExpo = (expo: Expo) => {
    setEditingExpo(expo);
    setFormData({
      name: expo.name,
      description: expo.description || '',
      theme: expo.theme || '',
      start_date: expo.start_date,
      end_date: expo.end_date,
      city: expo.city || '',
      country: expo.country || '',
      venue_name: expo.venue_name || '',
      status: expo.status,
      priority: expo.priority,
      expected_visitors: expo.expected_visitors?.toString() || '',
      booth_count: expo.booth_count?.toString() || '',
      budget: expo.budget?.toString() || '',
      manager_name: expo.manager_name || '',
      organizer_name: expo.organizer_name || '',
      website_url: expo.website_url || '',
      tags: expo.tags?.join(', ') || ''
    });
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      theme: '',
      start_date: '',
      end_date: '',
      city: '',
      country: '',
      venue_name: '',
      status: 'Planning',
      priority: 'Medium',
      expected_visitors: '',
      booth_count: '',
      budget: '',
      manager_name: '',
      organizer_name: '',
      website_url: '',
      tags: ''
    });
  };

  const exportExpos = () => {
    try {
      const csvContent = [
        ['Expo Number', 'Name', 'Status', 'Start Date', 'End Date', 'City', 'Country', 'Expected Visitors', 'Budget', 'Priority', 'Manager'].join(','),
        ...filteredExpos.map(expo => [
          expo.expo_number || '',
          `"${expo.name || ''}"`,
          expo.status || '',
          expo.start_date || '',
          expo.end_date || '',
          expo.city || '',
          expo.country || '',
          expo.expected_visitors || '',
          expo.budget || '',
          expo.priority || '',
          `"${expo.manager_name || ''}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `exhibitions_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: "Exhibitions data has been exported to CSV",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export exhibitions data",
        variant: "destructive",
      });
    }
  };

  // Filter expos based on search and filters
  const filteredExpos = expos.filter(expo => {
    const matchesSearch = !searchTerm ||
      expo.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expo.expo_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expo.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expo.theme?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expo.organizer_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all-status" || expo.status === statusFilter;
    const matchesPriority = priorityFilter === "all-priority" || expo.priority === priorityFilter;

    const matchesYear = yearFilter === "all-years" ||
      (expo.start_date && new Date(expo.start_date).getFullYear().toString() === yearFilter);

    const matchesTab = activeTab === 'all' ||
                      (activeTab === 'active' && expo.status === 'Active') ||
                      (activeTab === 'planning' && expo.status === 'Planning') ||
                      (activeTab === 'completed' && expo.status === 'Completed') ||
                      (activeTab === 'upcoming' && new Date(expo.start_date) > new Date());

    return matchesSearch && matchesStatus && matchesPriority && matchesYear && matchesTab;
  });

  // Calculate statistics
  const stats: ExpoStats = {
    total: expos.length,
    active: expos.filter(e => e.status === 'Active').length,
    planning: expos.filter(e => e.status === 'Planning').length,
    completed: expos.filter(e => e.status === 'Completed').length,
    registration: expos.filter(e => e.status === 'Registration Open').length,
    cancelled: expos.filter(e => e.status === 'Cancelled').length,
    totalRevenue: expos.reduce((sum, expo) => sum + (expo.totalRevenue || 0), 0),
    totalVisitors: expos.reduce((sum, expo) => sum + (expo.expected_visitors || 0), 0)
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active': return <Play className="h-3 w-3" />;
      case 'Planning': return <Clock className="h-3 w-3" />;
      case 'Registration Open': return <Users className="h-3 w-3" />;
      case 'Completed': return <CheckCircle className="h-3 w-3" />;
      case 'Cancelled': return <XCircle className="h-3 w-3" />;
      case 'Postponed': return <Pause className="h-3 w-3" />;
      case 'Marketing': return <Send className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800 border-green-200';
      case 'Planning': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Registration Open': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'Postponed': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Marketing': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Medium': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isOverdue = (expo: Expo) => {
    if (!expo.end_date) return false;
    const today = new Date();
    const endDate = new Date(expo.end_date);
    return endDate < today && expo.status !== 'Completed' && expo.status !== 'Cancelled';
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold tracking-tight">
            <Building2 className="inline-block h-8 w-8 mr-3 text-blue-600" />
            Exhibitions Management
          </h1><WorkflowLinks sections={["profitability"]}/>

          <p className="text-muted-foreground mt-2">
            Manage exhibitions, exhibitors, and event logistics
          </p>

        </div>

        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={refreshBoothCounts}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Booth Counts
          </Button>
          <Button variant="outline" onClick={exportExpos}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Exhibition
          </Button>
        </div>

      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card>
          <CardContent className="p-4">

            <div className="flex items-center space-x-2">

              <Building2 className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Exhibitions
                </p>
                <p className="text-2xl font-bold">
                  {stats.total}
                </p>
              </div>

              <TrendingUp className="h-4 w-4 text-green-600 ml-auto" />
            </div>

          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">

            <div className="flex items-center space-x-2">

              <Play className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Active
                </p>
                <p className="text-2xl font-bold">
                  {stats.active}
                </p>
              </div>

              <Activity className="h-4 w-4 text-green-600 ml-auto" />
            </div>

          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">

            <div className="flex items-center space-x-2">

              <Clock className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Planning
                </p>
                <p className="text-2xl font-bold">
                  {stats.planning}
                </p>
              </div>

              <Target className="h-4 w-4 text-blue-600 ml-auto" />
            </div>

          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">

            <div className="flex items-center space-x-2">

              <Users className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Registration Open
                </p>
                <p className="text-2xl font-bold">
                  {stats.registration}
                </p>
              </div>

              <Zap className="h-4 w-4 text-purple-600 ml-auto" />
            </div>

          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">

            <div className="flex items-center space-x-2">

              <CheckCircle className="h-4 w-4 text-gray-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Completed
                </p>
                <p className="text-2xl font-bold">
                  {stats.completed}
                </p>
              </div>

              <Award className="h-4 w-4 text-gray-600 ml-auto" />
            </div>

          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">

            <div className="flex items-center space-x-2">

              <XCircle className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Cancelled
                </p>
                <p className="text-2xl font-bold">
                  {stats.cancelled}
                </p>
              </div>

              <TrendingDown className="h-4 w-4 text-red-600 ml-auto" />
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
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </div>

              <BarChart3 className="h-4 w-4 text-green-600 ml-auto" />
            </div>

          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">

            <div className="flex items-center space-x-2">

              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Expected Visitors
                </p>
                <p className="text-2xl font-bold">
                  {stats.totalVisitors.toLocaleString()}
                </p>
              </div>

              <PieChart className="h-4 w-4 text-blue-600 ml-auto" />
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Exhibitions</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-6">

              <div className="flex flex-col lg:flex-row gap-4">

                <div className="flex-1">

                  <div className="relative">

                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search exhibitions..."
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
                      <SelectItem value="all-status">All Status</SelectItem>
                      <SelectItem value="Planning">Planning</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Registration Open">Registration Open</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                      <SelectItem value="Postponed">Postponed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <Target className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-priority">All Priority</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-years">All Years</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2026">2026</SelectItem>
                    </SelectContent>
                  </Select>

                </div>

              </div>
            </CardContent>
          </Card>
          {/* Exhibitions List */}
          {loading ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading exhibitions...</span>
                </div>
              </CardContent>
            </Card>
          ) : filteredExpos.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />

                <h3 className="text-lg font-semibold mb-2">
                  {expos.length === 0 ? "No Exhibitions Found" : "No Matching Exhibitions"}
                </h3>

                <p className="text-muted-foreground mb-4">
                  {expos.length === 0
                    ? "Get started by creating your first exhibition"
                    : "Try adjusting your search criteria or filters"
                  }
                </p>

                {expos.length === 0 && (
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Exhibition
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">

              {filteredExpos.map((expo) => (
                <Card key={expo.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-6">

                      <div className="flex items-start justify-between mb-4">

                        <div className="flex items-center space-x-3">

                          <div className="flex flex-col">
                            <Badge variant="outline" className="w-fit mb-2">
                              {expo.expo_number}
                            </Badge>
                            <Badge className={`w-fit ${getPriorityColor(expo.priority)}`}>
                              <Star className="h-3 w-3 mr-1" />
                              {expo.priority}
                            </Badge>
                          </div>

                        </div>

                        <div className="flex items-center space-x-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => navigate(`/expos/${expo.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {/* Quick Status Changes */}
                              {expo.status === 'Planning' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(expo.id, 'Marketing')}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Start Marketing
                                </DropdownMenuItem>
                              )}
                              {expo.status === 'Marketing' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(expo.id, 'Registration Open')}>
                                  <Users className="h-4 w-4 mr-2" />
                                  Open Registration
                                </DropdownMenuItem>
                              )}
                              {expo.status === 'Registration Open' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(expo.id, 'Active')}>
                                  <Play className="h-4 w-4 mr-2" />
                                  Start Exhibition
                                </DropdownMenuItem>
                              )}
                              {expo.status === 'Active' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(expo.id, 'Completed')}>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Mark Completed
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />

                              {/* Standard Actions */}
                              {expo.website_url && (
                                <DropdownMenuItem onClick={() => window.open(expo.website_url, '_blank')}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  View Website
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleEditExpo(expo)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Exhibition
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />

                              {/* Status Menu */}
                              <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleStatusChange(expo.id, 'Planning')}>
                                <Clock className="h-4 w-4 mr-2" />
                                Planning
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(expo.id, 'Marketing')}>
                                <Send className="h-4 w-4 mr-2" />
                                Marketing
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(expo.id, 'Registration Open')}>
                                <Users className="h-4 w-4 mr-2" />
                                Registration Open
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(expo.id, 'Active')}>
                                <Play className="h-4 w-4 mr-2" />
                                Active
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(expo.id, 'Completed')}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Completed
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(expo.id, 'Cancelled')}>
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancelled
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(expo.id, 'Postponed')}>
                                <Pause className="h-4 w-4 mr-2" />
                                Postponed
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteExpo(expo)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Exhibition
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Title and Theme */}
                      <div className="mb-4">

                        <h3 className="text-xl font-semibold mb-2">
                          {expo.name}
                        </h3>

                        {expo.theme && (
                          <p className="text-sm text-muted-foreground">
                            {expo.theme}
                          </p>
                        )}
                      </div>

                    </div>

                    {/* Status and Dates */}
                    <div className="px-6 pb-6 space-y-4">

                      <div className="flex items-center justify-between">

                        <div className="flex items-center space-x-2">

                          <Badge className={`${getStatusColor(expo.status)}`}>
                            {getStatusIcon(expo.status)}
                            {expo.status}
                          </Badge>
                          {isOverdue(expo) && (
                            <Badge className="bg-red-100 text-red-800 border-red-200">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Overdue
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">

                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <div>
                              <div className="font-medium">Start</div>
                              <div>{formatDate(expo.start_date)}</div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <div>
                              <div className="font-medium">End</div>
                              <div>{formatDate(expo.end_date)}</div>
                            </div>
                          </div>

                        </div>

                      </div>

                      {/* Location */}
                      {(expo.city || expo.venue_name) && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <div>
                            {expo.venue_name && <div className="font-medium">{expo.venue_name}</div>}
                            {expo.city && <div>{expo.city}{expo.country && `, ${expo.country}`}</div>}
                          </div>
                        </div>
                      )}

                      {/* Statistics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">

                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">Exhibitors</div>
                            <div className="text-muted-foreground">{expo.totalExhibitors || 0}</div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">Booths</div>
                            <div className="text-muted-foreground">{expo.booth_count || 0}</div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">Expected</div>
                            <div className="text-muted-foreground">{expo.expected_visitors?.toLocaleString() || 'TBD'}</div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">Revenue</div>
                            <div className="text-muted-foreground">{formatCurrency(expo.totalRevenue || 0)}</div>
                          </div>
                        </div>

                      </div>

                      {/* Manager */}
                      {expo.manager_name && (
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span className="font-medium">Manager:</span>
                          <span>{expo.manager_name}</span>
                        </div>
                      )}

                      {/* Tags */}
                      {expo.tags && expo.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {expo.tags.slice(0, 3).map((tag: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {expo.tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{expo.tags.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                  </CardContent>
                </Card>
              ))}
            </div>

          )}

          {/* Results Summary */}
          {!loading && (
            <div className="text-center text-sm text-muted-foreground py-4">
              Showing {filteredExpos.length} of {expos.length} exhibitions
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Exhibition Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Create New Exhibition
            </DialogTitle>
            <DialogDescription>
              Add a new exhibition to your event management system. Fill in the required information below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">

            {/* Basic Information Section */}
            <div className="space-y-4">

              <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="name">Exhibition Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter exhibition name"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Input
                    id="theme"
                    value={formData.theme}
                    onChange={(e) => setFormData(prev => ({ ...prev, theme: e.target.value }))}
                    placeholder="Exhibition theme"
                    className="w-full"
                  />
                </div>

              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the exhibition"
                  rows={3}
                  className="w-full resize-none"
                />
              </div>
            </div>

            {/* Date & Location Section */}
            <div className="space-y-4">

              <h3 className="text-lg font-semibold border-b pb-2">Date & Location</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City name"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="Country name"
                    className="w-full"
                  />
                </div>

              </div>

              <div className="space-y-2">
                <Label htmlFor="venue_name">Venue</Label>
                <Input
                  id="venue_name"
                  value={formData.venue_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, venue_name: e.target.value }))}
                  placeholder="Venue name and address"
                  className="w-full"
                />
              </div>

            </div>


            {/* Management & Settings Section */}
            <div className="space-y-4">

              <h3 className="text-lg font-semibold border-b pb-2">Management & Settings</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Planning">Planning</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Registration Open">Registration Open</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                      <SelectItem value="Postponed">Postponed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Critical">Critical</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manager_name">Manager</Label>
                  <Input
                    id="manager_name"
                    value={formData.manager_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, manager_name: e.target.value }))}
                    placeholder="Exhibition manager name"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organizer_name">Organizer</Label>
                  <Input
                    id="organizer_name"
                    value={formData.organizer_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, organizer_name: e.target.value }))}
                    placeholder="Organizing company/entity"
                    className="w-full"
                  />
                </div>

              </div>

            </div>


            {/* Capacity & Budget Section */}
            <div className="space-y-4">

              <h3 className="text-lg font-semibold border-b pb-2">Capacity & Budget</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="expected_visitors">Expected Visitors</Label>
                  <Input
                    id="expected_visitors"
                    type="number"
                    value={formData.expected_visitors}
                    onChange={(e) => setFormData(prev => ({ ...prev, expected_visitors: e.target.value }))}
                    placeholder="0"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="booth_count">Total Booths</Label>
                  <Input
                    id="booth_count"
                    type="number"
                    value={formData.booth_count}
                    onChange={(e) => setFormData(prev => ({ ...prev, booth_count: e.target.value }))}
                    placeholder="0"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="budget">Budget (USD)</Label>
                  <Input
                    id="budget"
                    type="number"
                    step="0.01"
                    value={formData.budget}
                    onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                    placeholder="0.00"
                    className="w-full"
                  />
                </div>

              </div>

            </div>


            {/* Additional Information Section */}
            <div className="space-y-4">

              <h3 className="text-lg font-semibold border-b pb-2">Additional Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="website_url">Website URL</Label>
                  <Input
                    id="website_url"
                    type="url"
                    value={formData.website_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                    placeholder="https://example.com"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="renewable, technology, sustainability, innovation"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Add relevant tags to help categorize and search for this exhibition
                  </p>
                </div>

              </div>

            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateExpo}>
              Create Exhibition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Exhibition Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Edit className="h-5 w-5 mr-2" />
              Edit Exhibition
            </DialogTitle>
            <DialogDescription>
              Update exhibition information and settings. Modify any field as needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">

            {/* Basic Information Section */}
            <div className="space-y-4">

              <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="edit_name">Exhibition Name *</Label>
                  <Input
                    id="edit_name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter exhibition name"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_theme">Theme</Label>
                  <Input
                    id="edit_theme"
                    value={formData.theme}
                    onChange={(e) => setFormData(prev => ({ ...prev, theme: e.target.value }))}
                    placeholder="Exhibition theme"
                    className="w-full"
                  />
                </div>

              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_description">Description</Label>
                <Textarea
                  id="edit_description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the exhibition"
                  rows={3}
                  className="w-full resize-none"
                />
              </div>
            </div>

            {/* Simplified Edit Form - Key Fields Only */}
            <div className="space-y-4">

              <h3 className="text-lg font-semibold border-b pb-2">Key Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="edit_start_date">Start Date</Label>
                  <Input
                    id="edit_start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_end_date">End Date</Label>
                  <Input
                    id="edit_end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Planning">Planning</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Registration Open">Registration Open</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                      <SelectItem value="Postponed">Postponed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Critical">Critical</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="space-y-2">
                  <Label htmlFor="edit_city">City</Label>
                  <Input
                    id="edit_city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City name"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit_venue_name">Venue</Label>
                  <Input
                    id="edit_venue_name"
                    value={formData.venue_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, venue_name: e.target.value }))}
                    placeholder="Venue name"
                    className="w-full"
                  />
                </div>

              </div>

            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateExpo}>
              Update Exhibition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exhibition</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the exhibition and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {expoToDelete && (
            <div className="my-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold">{expoToDelete.name}</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(expoToDelete.start_date).toLocaleDateString()} - {new Date(expoToDelete.end_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-3 w-3" />
                          <span>{expoToDelete.city || 'Location not specified'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="h-3 w-3" />
                          <span>{expoToDelete.totalExhibitors || 0} exhibitors, {expoToDelete.totalSponsors || 0} sponsors</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false);
              setExpoToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteExpo}>
              Delete Exhibition
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Expos;