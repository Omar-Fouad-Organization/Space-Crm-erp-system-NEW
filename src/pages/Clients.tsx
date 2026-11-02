import {useRef} from 'react';
import {loadPage,relatedToClients} from '@/services/laravelClient';
import {PageControls} from '@/components/workspace/PageControls';
import {WorkflowLinks} from '@/components/workspace/WorkflowLinks';
import {useQuickCreate} from '@/hooks/useQuickCreate';
import {all as apiAll,save as apiSave,remove as apiRemove,metadata as apiMetadata} from '@/services/laravelClient';
import {api} from '@/crm/api';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { CreateButton, EditButton, DeleteButton } from '@/components/auth/PermissionButton';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Building2,
  Mail,
  Phone,
  MapPin,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Download,
  Users,
  User,
  Grid3X3,
  List,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Calendar,
  DollarSign,
  Activity,
  FileText,
  BarChart3,
  PieChart,
  Target,
  Award,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Briefcase,
  Heart,
  HeartOff
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { clientService, type Client, type ClientMetrics, type ClientActivity, type ClientDocument } from '@/services/supabaseService';
import { CreateClientDialog } from '@/components/forms/CreateClientDialog';
import { EditClientDialog } from '@/components/forms/EditClientDialog';
import ModernDeleteButton from '@/components/ui/ModernDeleteButton';

const Clients = () => {
  const { toast } = useToast();
  const [page,setPage]=useState(1),[pageInfo,setPageInfo]=useState({total:0,last_page:1});
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  useQuickCreate(()=>setShowCreateDialog(true));
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);

  // Mock data for enhanced features
  const [clientMetrics, setClientMetrics] = useState<Record<string, ClientMetrics>>({});
  const [clientActivities, setClientActivities] = useState<Record<string, ClientActivity[]>>({});
  const [clientDocuments, setClientDocuments] = useState<Record<string, ClientDocument[]>>({});

  useEffect(() => {
    const timer=setTimeout(()=>void loadClients(),250);return()=>clearTimeout(timer);
  }, [page,searchTerm,typeFilter,statusFilter]);
  useEffect(()=>setPage(1),[searchTerm,typeFilter,statusFilter]);

  useEffect(() => {
    filterClients();
  }, [clients, searchTerm, typeFilter, statusFilter]);

  const loadVersion=useRef(0);
  const loadClients = async () => {
    const version=++loadVersion.current;
    try {
      setLoading(true);
      const result=await loadPage('clients',{page,per_page:50,q:searchTerm,type:typeFilter==='all'?'':typeFilter.toLowerCase().replaceAll(' ','_'),status:statusFilter==='all'?'':statusFilter.toLowerCase().replaceAll(' ','_')});const data=result.data as unknown as Client[];if(version!==loadVersion.current)return;if(page>result.last_page){setPage(result.last_page);return;}setPageInfo(result);
      setClients(data);

      const [deals,tasks,docs]=await apiMetadata().then(meta=>Promise.all(['deals','tasks','documents'].map(r=>meta.resources[r]?relatedToClients(r,data.map(c=>c.id)):Promise.resolve([]))));
      const metrics:any={},activities:any={},documents:any={};
      for(const client of data){const linked=deals.filter(d=>d.client_id===client.id),won=linked.filter(d=>d.stage==='closed_won');const sum=(rows:any[])=>rows.reduce((n,r)=>n+Number(r.deal_value),0);metrics[client.id]={total_deals:linked.length,active_deals:linked.filter(d=>!['closed_won','closed_lost','cancelled'].includes(d.stage)).length,won_deals:won.length,total_value:sum(linked),won_value:sum(won),avg_deal_size:linked.length?sum(linked)/linked.length:0,conversion_rate:linked.length?won.length/linked.length*100:0,lifetime_value:sum(won),open_tasks:tasks.filter(t=>t.client_id===client.id&&t.status!=='completed').length,overdue_payments:0,last_activity:client.updated_at||client.created_at,engagement_score:0,satisfaction_score:0,growth_trend:'stable'};activities[client.id]=linked.map(d=>({id:d.id,type:'deal',title:d.title,description:d.description||'',timestamp:d.updated_at,status:d.status,user:d.assigned_to_name}));documents[client.id]=docs.filter(d=>d.client_id===client.id).map(d=>({...d,name:d.title,uploaded_at:d.created_at,uploaded_by:d.created_by_name,category:d.document_type,size:(d.attachments||[]).reduce((n:any,a:any)=>n+a.size,0)}));}
      if(version!==loadVersion.current)return;
      setClientMetrics(metrics);
      setClientActivities(activities);
      setClientDocuments(documents);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast({
        title: "Error",
        description: "Failed to load clients. Please try again.",
        variant: "destructive",
      });
    } finally {
      if(version===loadVersion.current)setLoading(false);
    }
  };

  const filterClients = () => {
    let filtered = clients;

    if (searchTerm) {
      filtered = filtered.filter(client =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(client => client.type === typeFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(client => client.status === statusFilter);
    }

    setFilteredClients(filtered);
  };

  // Delete function for modern delete button
  const handleDeleteClient = async (clientId: string, clientName: string) => {
    try {
      await clientService.delete(clientId);
      toast({
        title: "Client Deleted",
        description: `Client "${clientName}" has been deleted successfully`,
      });
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast({
        title: "Error",
        description: "Failed to delete client. Please try again.",
        variant: "destructive",
      });
      throw error; // Re-throw to let ModernDeleteButton handle the error state
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'Active': { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      'Inactive': { color: 'bg-gray-100 text-gray-800', icon: XCircle },
      'Prospect': { color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
      'Interested': { color: 'bg-yellow-100 text-yellow-800', icon: Heart },
      'Not Interested': { color: 'bg-red-100 text-red-800', icon: HeartOff }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.Active;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getEngagementScore = (score: number) => {
    if (score >= 80) return { color: 'text-green-600', label: 'High' };
    if (score >= 60) return { color: 'text-yellow-600', label: 'Medium' };
    return { color: 'text-red-600', label: 'Low' };
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'deal': return <Briefcase className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      case 'call': return <Phone className="h-4 w-4" />;
      case 'task': return <CheckCircle className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const renderClientCard = (client: Client) => {
    const metrics = clientMetrics[client.id];
    const engagement = getEngagementScore(metrics?.engagement_score || 0);

    return (
      <Card key={client.id} className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">

            <div className="flex items-center space-x-3">

              <div className="p-2 bg-blue-100 rounded-lg">

                <Building2 className="h-5 w-5 text-blue-600" />

              </div>

              <div className="flex-1 min-w-0">

                <h3 className="font-semibold text-lg text-gray-900 truncate">
                  {client.name}
                </h3>
                <div className="flex items-center text-sm text-gray-500 mt-1">
                  {client.company && (
                    <>
                      <Building2 className="h-3 w-3 mr-1" />
                      {client.company}
                    </>
                  )}
                </div>

              </div>

            </div>

            <div className="flex items-center space-x-2">

              {getStatusBadge(client.status || 'Active')}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    setSelectedClient(client);
                    setShowClientDetails(true);
                  }}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setSelectedClient(client);
                    setShowEditDialog(true);
                  }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>

                    <ModernDeleteButton
                      onDelete={async () => {
                        await handleDeleteClient(client.id, client.name);
                      }}
                      variant="text"
                      title="Delete Client"
                      itemName={client.name}
                      itemDetails={
                        <div className="space-y-1 text-sm">

                          <div>Company: {client.company}</div>

                          <div>Email: {client.email}</div>

                          <div>Phone: {client.phone}</div>

                          <div>Type: {client.type}</div>

                        </div>

                      }
                      dangerLevel="medium"
                      className="w-full justify-start text-red-600 hover:text-red-700"
                    />
                  </DropdownMenuItem>

                </DropdownMenuContent>
              </DropdownMenu>
            </div>

          </div>

        </CardHeader>
        <CardContent className="pt-0">

          <div className="grid grid-cols-2 gap-4 mb-4">

            <div className="flex items-center text-sm text-gray-600">
              <User className="h-4 w-4 mr-2" />
              {client.type}
            </div>

            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="h-4 w-4 mr-2" />
              {client.city || 'N/A'}
            </div>

            <div className="flex items-center text-sm text-gray-600">
              <Mail className="h-4 w-4 mr-2" />
              {client.email}
            </div>

            <div className="flex items-center text-sm text-gray-600">
              <Phone className="h-4 w-4 mr-2" />
              {client.phone || 'N/A'}
            </div>

          </div>

          {metrics && (
            <div className="border-t pt-4">

              <div className="grid grid-cols-2 gap-4">

                <div className="text-center">

                  <div className="text-xs text-gray-500 mb-1">
                    Total Deals
                  </div>

                  <div className="font-semibold text-gray-900">
                    {metrics.total_deals}
                  </div>

                </div>

                <div className="text-center">

                  <div className="text-xs text-gray-500 mb-1">
                    Total Value
                  </div>

                  <div className="font-semibold text-gray-900">
                    {formatCurrency(metrics.total_value)}
                  </div>

                </div>

                <div className="text-center">

                  <div className="text-xs text-gray-500 mb-1">
                    Conversion Rate
                  </div>

                  <div className="font-semibold text-gray-900">
                    {metrics.conversion_rate}%
                  </div>

                </div>

                <div className="text-center">

                  <div className="flex items-center justify-center text-xs text-gray-500 mb-1">

                    Engagement
                    <Target className="h-3 w-3 ml-1" />
                  </div>

                  <div className={`font-semibold ${engagement.color}`}>

                    {engagement.label}
                  </div>

                </div>

              </div>

            </div>

          )}
        </CardContent>
      </Card>
    );
  };

  const renderClientDetails = () => {
    if (!selectedClient) return null;

    const metrics = clientMetrics[selectedClient.id];
    const activities = clientActivities[selectedClient.id] || [];
    const documents = clientDocuments[selectedClient.id] || [];
    const engagement = getEngagementScore(metrics?.engagement_score || 0);

    return (
      <Dialog open={showClientDetails} onOpenChange={setShowClientDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Building2 className="h-6 w-6 text-blue-600" />
                {selectedClient.name}
                {getStatusBadge(selectedClient.status || 'Active')}
              </div>
            </div>
            <DialogDescription>
              Comprehensive client profile and analytics
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-6">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <User className="h-5 w-5 mr-2" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">

                    <div className="flex items-center space-x-3">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span>{selectedClient.email}</span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span>{selectedClient.phone || 'Not provided'}</span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      <span>{selectedClient.company || 'Not provided'}</span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span>{selectedClient.city ? `${selectedClient.city}, ${selectedClient.country || ''}` : 'Not provided'}</span>
                    </div>

                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Briefcase className="h-5 w-5 mr-2" />
                      Business Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">

                    <div className="flex justify-between">
                      <span className="text-gray-500">Client Type</span>
                      <span className="font-medium">{selectedClient.type}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-500">Industry</span>
                      <span className="font-medium">{selectedClient.industry || 'Not specified'}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-500">Company Size</span>
                      <span className="font-medium">{selectedClient.company_size || 'Not specified'}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-500">Website</span>
                      <span className="font-medium">{selectedClient.website || 'Not provided'}</span>
                    </div>

                  </CardContent>
                </Card>
              </div>

              {selectedClient.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <FileText className="h-5 w-5 mr-2" />
                      Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{selectedClient.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="metrics" className="space-y-6">
              {metrics && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">

                        <div className="flex items-center justify-center mb-2">

                          <Target className="h-5 w-5 text-blue-600" />

                        </div>

                        <div className="text-sm text-gray-500 mb-1">
                          Total Deals
                        </div>

                        <div className="text-2xl font-bold text-gray-900">
                          {metrics.total_deals}
                        </div>

                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">

                        <div className="flex items-center justify-center mb-2">

                          <DollarSign className="h-5 w-5 text-green-600" />

                        </div>

                        <div className="text-sm text-gray-500 mb-1">
                          Total Value
                        </div>

                        <div className="text-2xl font-bold text-gray-900">
                          {formatCurrency(metrics.total_value)}
                        </div>

                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">

                        <div className="flex items-center justify-center mb-2">

                          <BarChart3 className="h-5 w-5 text-purple-600" />

                        </div>

                        <div className="text-sm text-gray-500 mb-1">
                          Conversion Rate
                        </div>

                        <div className="text-2xl font-bold text-gray-900">
                          {metrics.conversion_rate}%
                        </div>

                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">

                        <div className="flex items-center justify-center mb-2">

                          <Award className="h-5 w-5 text-orange-600" />

                        </div>

                        <div className="text-sm text-gray-500 mb-1">
                          Engagement
                        </div>

                        <div className={`text-2xl font-bold ${engagement.color}`}>
                          {engagement.label}
                        </div>

                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <PieChart className="h-5 w-5 mr-2" />
                          Deal Performance
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">

                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Active Deals</span>
                          <span className="font-semibold">{metrics.active_deals}</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Won Deals</span>
                          <span className="font-semibold">{metrics.won_deals}</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Average Deal Size</span>
                          <span className="font-semibold">{formatCurrency(metrics.avg_deal_size)}</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Lifetime Value</span>
                          <span className="font-semibold">{formatCurrency(metrics.lifetime_value)}</span>
                        </div>

                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Clock className="h-5 w-5 mr-2" />
                          Current Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">

                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Open Tasks</span>
                          <span className="font-semibold">{metrics.open_tasks}</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Overdue Payments</span>
                          <Badge variant={metrics.overdue_payments > 0 ? "destructive" : "outline"}>
                            {metrics.overdue_payments}
                          </Badge>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Growth Trend</span>
                          <div className="flex items-center space-x-1">

                            {getTrendIcon(metrics.growth_trend)}
                            <span className="capitalize">{metrics.growth_trend}</span>
                          </div>

                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Satisfaction Score</span>
                          <div className="flex items-center space-x-1">

                            {Array.from({ length: 5 }, (_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < metrics.satisfaction_score
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>

                        </div>

                      </CardContent>
                    </Card>
                  </div>

                </>
              )}
            </TabsContent>
            <TabsContent value="activity" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="h-5 w-5 mr-2" />
                    Recent Activity Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">

                    {activities.map((activity, index) => (
                      <div key={activity.id} className="flex items-start space-x-4 pb-4 border-b last:border-b-0">

                        <div className="p-2 bg-gray-100 rounded-full">
                          {getActivityIcon(activity.type)}
                        </div>

                        <div className="flex-1 min-w-0">

                          <div className="flex items-center justify-between mb-1">

                            <h4 className="font-medium text-gray-900">{activity.title}</h4>

                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              {activity.priority && (
                                <Badge variant="outline" className="text-xs">
                                  {activity.priority}
                                </Badge>
                              )}
                              <span className="text-xs">
                                {new Date(activity.timestamp).toLocaleDateString()}
                              </span>
                            </div>

                          </div>

                          <p className="text-gray-600 text-sm mb-1">{activity.description}</p>
                          <p className="text-xs text-gray-500">by {activity.user}</p>

                        </div>

                      </div>

                    ))}
                  </div>

                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="documents" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Client Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">

                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">

                        <div className="flex items-center space-x-3">
                          <FileText className="h-8 w-8 text-blue-600" />
                          <div>

                            <h4 className="font-medium text-gray-900">{doc.name}</h4>

                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              <span>{doc.type}</span>
                              <span>•</span>
                              <span>{formatFileSize(doc.size)}</span>
                              <span>•</span>
                              <span>Uploaded by {doc.uploaded_by}</span>
                              <span>•</span>
                              <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                            </div>

                          </div>

                        </div>

                        <div className="flex items-center space-x-2">
                          <Badge variant={doc.status === 'signed' ? 'default' : 'secondary'}>
                            {doc.status}
                          </Badge>
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>

                      </div>

                    ))}
                  </div>

                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-3xl font-bold text-gray-900">
            Clients
          </h1><WorkflowLinks sections={["imports"]}/>

          <p className="text-gray-600 mt-1">
            Manage your client relationships and track engagement
          </p>

        </div>

        <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>

      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Clients
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {clients.length}
                </p>
              </div>

              <Users className="h-8 w-8 text-blue-600" />
            </div>

          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Clients
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {clients.filter(c => c.status === 'Active').length}
                </p>
              </div>

              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>

          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm font-medium text-gray-600">
                  Prospects
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {clients.filter(c => c.status === 'Prospect').length}
                </p>
              </div>

              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>

          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm font-medium text-gray-600">
                  This Month
                </p>
                <p className="text-3xl font-bold text-gray-900">
                  {clients.filter(c => {
                    const created = new Date(c.created_at);
                    const now = new Date();
                    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>

              <Calendar className="h-8 w-8 text-purple-600" />
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">

            <div className="flex-1">

              <div className="relative">

                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />

                <Input
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Sponsors">Sponsors</SelectItem>
                <SelectItem value="Exhibitors">Exhibitors</SelectItem>
                <SelectItem value="Partners">Partners</SelectItem>
                <SelectItem value="Vendors">Vendors</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Prospect">Prospect</SelectItem>
                <SelectItem value="Interested">Interested</SelectItem>
                <SelectItem value="Not Interested">Not Interested</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="outline" onClick={loadClients}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

        </CardContent>
      </Card>

      {/* Clients Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map(renderClientCard)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => {
                  const metrics = clientMetrics[client.id];
                  const engagement = getEngagementScore(metrics?.engagement_score || 0);

                  return (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">

                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Building2 className="h-4 w-4 text-blue-600" />
                          </div>

                          <div>
                            <p className="font-medium text-gray-900">{client.name}</p>
                            <p className="text-sm text-gray-500">{client.company}</p>
                          </div>

                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{client.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">

                          <div className="flex items-center text-sm">
                            <Mail className="h-3 w-3 mr-1 text-gray-400" />
                            <span>{client.email}</span>
                          </div>

                          {client.phone && (
                            <div className="flex items-center text-sm">
                              <Phone className="h-3 w-3 mr-1 text-gray-400" />
                              <span>{client.phone}</span>
                            </div>
                          )}
                        </div>

                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                          <span>{client.city || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(client.status || 'Active')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-2 ${engagement.color.replace('text-', 'bg-')}`}></div>
                          <span className={`text-sm font-medium ${engagement.color}`}>
                            {engagement.label}
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
                            <DropdownMenuItem onClick={() => {
                              setSelectedClient(client);
                              setShowClientDetails(true);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedClient(client);
                              setShowEditDialog(true);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>

                              <ModernDeleteButton
                                onDelete={async () => {
                                  await handleDeleteClient(client.id, client.name);
                                }}
                                variant="text"
                                title="Delete Client"
                                itemName={client.name}
                                itemDetails={
                                  <div className="space-y-1 text-sm">

                                    <div>Company: {client.company}</div>

                                    <div>Email: {client.email}</div>

                                    <div>Phone: {client.phone}</div>

                                    <div>Type: {client.type}</div>

                                  </div>

                                }
                                dangerLevel="medium"
                                className="w-full justify-start text-red-600 hover:text-red-700"
                              />
                            </DropdownMenuItem>

                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              <TableBody>
              </TableBody>
            </Table>

          </CardContent>
        </Card>
      )}

      {filteredClients.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No clients found
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Get started by adding your first client'}
            </p>
            {!searchTerm && typeFilter === 'all' && statusFilter === 'all' && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Client
              </Button>
            )}
          </CardContent>
        </Card>
      )}

<PageControls page={page} total={pageInfo.total} last={pageInfo.last_page} onPage={setPage}/>
      {/* Dialogs */}
      <CreateClientDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={loadClients}
      />
      <EditClientDialog
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        onSuccess={loadClients}
        client={selectedClient}
      />
      {renderClientDetails()}

    </div>
  );
};

export default Clients;