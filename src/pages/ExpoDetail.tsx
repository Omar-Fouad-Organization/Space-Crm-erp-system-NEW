import {all as apiAll,save as apiSave,remove as apiRemove,metadata as apiMetadata} from '@/services/laravelClient';
import {api} from '@/crm/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Globe,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  Building2,
  Trophy,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  Edit,
  Share2,
  Download,
  Plus,
  FileText,
  BarChart3,
  PieChart,
  Activity,
  TrendingUp,
  Star,
  Award,
  Target,
  Play,
  XCircle,
  Pause,
  Zap,
  ExternalLink,
  User,
  Briefcase,
  Mail,
  Phone,
  Loader2
} from "lucide-react";

interface ExpoData {
  id: string;
  expo_number: string;
  name: string;
  description: string;
  theme?: string;
  start_date: string;
  end_date: string;
  city?: string;
  country?: string;
  venue_name?: string;
  status: 'Planning' | 'Marketing' | 'Registration Open' | 'Active' | 'Completed' | 'Cancelled' | 'Postponed';
  priority: string;
  expected_visitors?: number;
  booth_count?: number;
  budget?: number;
  manager_name?: string;
  organizer_name?: string;
  website_url?: string;
  tags?: string[];
  totalBooths: number;
  bookedBooths: number;
  totalRevenue: number;
  occupancyRate: number;
  sponsors: number;
  attendees: number;
  analytics: ExpoAnalytics;
  timeline: ExpoEvent[];
}

interface ExpoAnalytics {
  total_exhibitors: number;
  total_visitors: number;
  revenue_generated: number;
  satisfaction_score: number;
  lead_conversions: number;
  networking_sessions: number;
}

interface ExpoEvent {
  id: string;
  type: 'planning' | 'setup' | 'opening' | 'event' | 'closing' | 'marketing';
  title: string;
  description: string;
  date: string;
  user: string;
  status: 'completed' | 'pending' | 'cancelled';
}

const ExpoDetail = () => {
  const { expoId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [expoData, setExpoData] = useState<ExpoData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadExpoData();
  }, [expoId]);

  const loadExpoData = async()=>{setLoading(true);try{const [expos,booths,deals]=await Promise.all([apiAll('exhibitions'),apiAll('booths'),apiAll('deals')]);const e=expos.find(e=>e.id===expoId);if(!e)throw new Error('Exhibition not found');const related=booths.filter(b=>b.exhibition_id===e.id),won=deals.filter(d=>d.exhibition_id===e.id&&d.stage==='closed_won'),booked=related.filter(b=>b.status!=='Available').length,revenue=won.reduce((n,d)=>n+Number(d.deal_value),0);setExpoData({...e,totalBooths:related.length,bookedBooths:booked,totalRevenue:revenue,occupancyRate:related.length?booked/related.length*100:0,sponsors:won.filter(d=>d.deal_type!=='booth').length,attendees:Number(e.attendees||0),tags:e.tags||[],analytics:{total_exhibitors:won.length,total_visitors:Number(e.total_visitors||0),revenue_generated:revenue,satisfaction_score:0,lead_conversions:0,networking_sessions:0},timeline:[]} as any);}catch(error){toast({title:'Exhibition unavailable',description:(error as Error).message,variant:'destructive'});}finally{setLoading(false);}};

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'Planning': { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Clock className="h-3 w-3 mr-1" /> },
      'Marketing': { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: <Target className="h-3 w-3 mr-1" /> },
      'Registration Open': { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: <Users className="h-3 w-3 mr-1" /> },
      'Active': { color: 'bg-green-100 text-green-800 border-green-200', icon: <Play className="h-3 w-3 mr-1" /> },
      'Completed': { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      'Cancelled': { color: 'bg-red-100 text-red-800 border-red-200', icon: <XCircle className="h-3 w-3 mr-1" /> },
      'Postponed': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Pause className="h-3 w-3 mr-1" /> }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['Planning'];

    return (
      <Badge className={`${config.color}`}>
        {config.icon}
        {status}
      </Badge>
    );
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'planning': return <FileText className="h-4 w-4" />;
      case 'setup': return <Building2 className="h-4 w-4" />;
      case 'opening': return <Play className="h-4 w-4" />;
      case 'event': return <Calendar className="h-4 w-4" />;
      case 'closing': return <Award className="h-4 w-4" />;
      case 'marketing': return <Target className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getEventStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">

        <div className="flex items-center justify-between">

          <Button variant="outline" onClick={() => navigate('/expos')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 animate-pulse rounded mb-2" />
                <div className="h-8 bg-gray-200 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>

      </div>
    );
  }

  if (!expoData) {
    return (
      <div className="space-y-6">

        <Button variant="outline" onClick={() => navigate('/expos')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Exhibition Not Found
            </h3>
            <p className="text-muted-foreground mb-4">
              The requested exhibition could not be found.
            </p>
            <Button onClick={() => navigate('/expos')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Exhibitions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">

        <Button variant="outline" onClick={() => navigate('/expos')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1 mx-6">

          <div className="flex items-center space-x-4">
            <Building2 className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{expoData.name}</h1>
              <div className="flex items-center space-x-4 mt-2">
                <span className="text-muted-foreground">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  {expoData.venue_name}
                </span>
                {getStatusBadge(expoData.status)}
              </div>
            </div>
          </div>

        </div>

        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Edit Exhibition
          </Button>
        </div>

      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(expoData.analytics.revenue_generated)}
                </p>
              </div>
              <TrendingUp className="h-4 w-4 text-green-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Visitors
                </p>
                <p className="text-2xl font-bold">
                  {expoData.analytics.total_visitors.toLocaleString()}
                </p>
              </div>
              <Activity className="h-4 w-4 text-blue-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Lead Conversions
                </p>
                <p className="text-2xl font-bold">
                  {expoData.analytics.lead_conversions}
                </p>
              </div>
              <Zap className="h-4 w-4 text-purple-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Networking Sessions
                </p>
                <p className="text-2xl font-bold">
                  {expoData.analytics.networking_sessions}
                </p>
              </div>
              <Briefcase className="h-4 w-4 text-orange-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Star className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Satisfaction Score
                </p>
                <p className="text-2xl font-bold">
                  {expoData.analytics.satisfaction_score}/5.0
                </p>
              </div>
              <Award className="h-4 w-4 text-yellow-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Trophy className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Sponsors
                </p>
                <p className="text-2xl font-bold">
                  {expoData.sponsors}
                </p>
              </div>
              <Building2 className="h-4 w-4 text-green-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">

          {/* Exhibition Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Exhibition Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-muted-foreground">{expoData.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>
                  <span className="font-medium">Start Date</span>
                  <p className="text-muted-foreground">{formatDate(expoData.start_date)}</p>
                </div>

                <div>
                  <span className="font-medium">End Date</span>
                  <p className="text-muted-foreground">{formatDate(expoData.end_date)}</p>
                </div>

                <div>
                  <span className="font-medium">Duration</span>
                  <p className="text-muted-foreground">
                    {Math.ceil((new Date(expoData.end_date).getTime() - new Date(expoData.start_date).getTime()) / (1000 * 60 * 60 * 24))} days
                  </p>
                </div>

                <div>
                  <span className="font-medium">Venue</span>
                  <p className="text-muted-foreground">{expoData.venue_name}</p>
                </div>

                <div>
                  <span className="font-medium">Total Booths</span>
                  <p className="text-muted-foreground">{expoData.totalBooths}</p>
                </div>

                <div>
                  <span className="font-medium">Occupancy</span>
                  <p className="text-muted-foreground">{expoData.occupancyRate.toFixed(1)}%</p>
                </div>

              </div>

              {/* Tags */}
              {expoData.tags && expoData.tags.length > 0 && (
                <div>
                  <span className="font-medium">Tags</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {expoData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Analytics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Performance Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                <div className="text-center">
                  <p className="text-2xl font-bold">{expoData.analytics.total_exhibitors}</p>
                  <p className="text-sm text-muted-foreground">Exhibitors</p>
                </div>

                <div className="text-center">
                  <p className="text-2xl font-bold">{expoData.analytics.total_visitors.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Visitors</p>
                </div>

                <div className="text-center">
                  <p className="text-2xl font-bold">{expoData.analytics.lead_conversions}</p>
                  <p className="text-sm text-muted-foreground">Lead Conversions</p>
                </div>

                <div className="text-center">
                  <p className="text-2xl font-bold">{expoData.analytics.networking_sessions}</p>
                  <p className="text-sm text-muted-foreground">Networking Sessions</p>
                </div>

                <div className="text-center">
                  <p className="text-2xl font-bold">{expoData.analytics.satisfaction_score}/5.0</p>
                  <p className="text-sm text-muted-foreground">Satisfaction Score</p>
                </div>

                <div className="text-center">
                  <p className="text-2xl font-bold">{expoData.sponsors}</p>
                  <p className="text-sm text-muted-foreground">Sponsors</p>
                </div>

              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Sidebar Info */}
        <div className="space-y-6">

          {/* Revenue & Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Revenue & Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-green-600">{formatCurrency(expoData.totalRevenue)}</p>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Booth Occupancy:</span>
                  <span className="text-sm font-medium">
                    {expoData.bookedBooths} / {expoData.totalBooths}
                  </span>
                </div>
                <Progress value={expoData.occupancyRate} className="h-2" />
              </div>

              <div className="space-y-2 mt-4">
                <div className="flex justify-between text-sm">
                  <span>Expected Attendees:</span>
                  <span className="font-medium">{expoData.attendees.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Sponsors:</span>
                  <span className="font-medium">{expoData.sponsors}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Satisfaction:</span>
                  <span className="font-medium">{expoData.analytics.satisfaction_score}/5.0</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exhibition Details */}
          <Card>
            <CardHeader>
              <CardTitle>Exhibition Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Expo Number:</span>
                <span className="font-medium">{expoData.expo_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Status:</span>
                {getStatusBadge(expoData.status)}
              </div>
              <div className="flex justify-between text-sm">
                <span>Priority:</span>
                <Badge variant="outline">
                  {expoData.priority}
                </Badge>
              </div>
              {expoData.theme && (
                <div className="flex justify-between text-sm">
                  <span>Theme:</span>
                  <span className="font-medium">{expoData.theme}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Location:</span>
                <span className="font-medium">{expoData.city}, {expoData.country}</span>
              </div>
              {expoData.manager_name && (
                <div className="flex justify-between text-sm">
                  <span>Manager:</span>
                  <span className="font-medium">{expoData.manager_name}</span>
                </div>
              )}
              {expoData.organizer_name && (
                <div className="flex justify-between text-sm">
                  <span>Organizer:</span>
                  <span className="font-medium">{expoData.organizer_name}</span>
                </div>
              )}
              {expoData.website_url && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(expoData.website_url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Visit Website
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full" onClick={() => navigate('/booths')}>
                <Building2 className="h-4 w-4 mr-2" />
                Manage Booths
              </Button>
              <Button variant="outline" className="w-full">
                <Users className="h-4 w-4 mr-2" />
                View Exhibitors
              </Button>
              <Button variant="outline" className="w-full">
                <Trophy className="h-4 w-4 mr-2" />
                Manage Sponsors
              </Button>
              <Button variant="outline" className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="exhibitors">Exhibitors</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Exhibition Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Status:</span>
                  {getStatusBadge(expoData.status)}
                </div>
                <div className="flex justify-between text-sm">
                  <span>Venue:</span>
                  <span className="font-medium">{expoData.venue_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Duration:</span>
                  <span className="font-medium">
                    {Math.ceil((new Date(expoData.end_date).getTime() - new Date(expoData.start_date).getTime()) / (1000 * 60 * 60 * 24))} days
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Booths:</span>
                  <span className="font-medium">{expoData.totalBooths}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Booked Booths:</span>
                  <span className="font-medium">{expoData.bookedBooths}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Key Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Revenue:</span>
                  <span className="font-medium">{formatCurrency(expoData.totalRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Occupancy Rate:</span>
                  <span className="font-medium">{expoData.occupancyRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Expected Visitors:</span>
                  <span className="font-medium">{expoData.attendees.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Sponsors:</span>
                  <span className="font-medium">{expoData.sponsors}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Satisfaction:</span>
                  <span className="font-medium">{expoData.analytics.satisfaction_score}/5.0</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="exhibitors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exhibitor Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Exhibitor Directory</h3>
                <p className="text-muted-foreground mb-4">
                  Manage exhibitor registrations, booth assignments, and communications
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Exhibitor
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exhibition Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {expoData.timeline.map((event) => (
                  <div key={event.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium">{event.title}</h4>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(event.date)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">by {event.user}</span>
                        <Badge className={getEventStatusColor(event.status)}>
                          {event.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Revenue
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(expoData.analytics.revenue_generated)}
                    </p>
                  </div>
                  <TrendingUp className="h-4 w-4 text-green-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Visitors
                    </p>
                    <p className="text-2xl font-bold">
                      {expoData.analytics.total_visitors.toLocaleString()}
                    </p>
                  </div>
                  <Activity className="h-4 w-4 text-blue-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Lead Conversions
                    </p>
                    <p className="text-2xl font-bold">
                      {expoData.analytics.lead_conversions}
                    </p>
                  </div>
                  <Zap className="h-4 w-4 text-purple-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Star className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Satisfaction Score
                    </p>
                    <p className="text-2xl font-bold">
                      {expoData.analytics.satisfaction_score}/5.0
                    </p>
                  </div>
                  <Award className="h-4 w-4 text-yellow-600 ml-auto" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance Chart</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Exhibition performance analytics chart will be displayed here
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExpoDetail;
