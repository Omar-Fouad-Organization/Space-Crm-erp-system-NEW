import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Building2,
  Users,
  DollarSign,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  Award,
  Target,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit,
  Share2,
  Download,
  Plus,
  Eye,
  FileText,
  CreditCard,
  Handshake,
  Crown,
  Zap,
  Flag,
  Bookmark,
  Heart,
  MessageSquare,
  Settings,
  Ruler,
  Wifi,
  Car,
  Grid3X3,
  XCircle,
  Loader2
} from 'lucide-react';

// Booth data interface
interface BoothData {
  id: string;
  code: string;
  size_sqm: number;
  price_per_meter: number;
  total_price: number;
  zone: string;
  aisle: string;
  hall: string;
  is_corner: boolean;
  status: 'Available' | 'Reserved' | 'Confirmed' | 'Occupied';
  client?: {
    id: string;
    name: string;
    contact_person: string;
    email: string;
    phone: string;
  };
  expo?: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  };
  deal?: {
    id: string;
    title: string;
    value: number;
    status: string;
  };
  features: string[];
  reserved_date?: string;
  confirmed_date?: string;
  setup_date?: string;
  breakdown_date?: string;
  notes?: string;
  analytics: BoothAnalytics;
  timeline: BoothEvent[];
}

interface BoothAnalytics {
  revenue_generated: number;
  visitor_count: number;
  lead_conversions: number;
  satisfaction_score: number;
  utilization_rate: number;
  setup_efficiency: number;
}

interface BoothEvent {
  id: string;
  type: 'reservation' | 'confirmation' | 'setup' | 'event' | 'breakdown';
  title: string;
  description: string;
  date: string;
  user: string;
  status: 'completed' | 'pending' | 'cancelled';
}

const BoothDetail = () => {
  const { boothId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [boothData, setBoothData] = useState<BoothData | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadBoothData();
  }, [boothId]);

  const loadBoothData = async () => {
    setLoading(true);
    try {
      // Mock booth data - replace with actual API call
      const mockBoothData: BoothData = {
        id: boothId || '1',
        code: 'A-101',
        size_sqm: 48,
        price_per_meter: 1200,
        total_price: 57600,
        zone: 'Zone A',
        aisle: 'Main Aisle',
        hall: 'Hall 1',
        is_corner: true,
        status: 'Confirmed',
        client: {
          id: 'client-1',
          name: 'EcoTech Solutions',
          contact_person: 'John Smith',
          email: 'john.smith@ecotech.com',
          phone: '+1 (555) 123-4567'
        },
        expo: {
          id: 'expo-1',
          name: 'Green Life Expo 2024',
          start_date: '2024-03-15',
          end_date: '2024-03-18'
        },
        deal: {
          id: 'deal-1',
          title: 'Main Sponsor Package',
          value: 57600,
          status: 'Closed Won'
        },
        features: ['Power', 'WiFi', 'Corner Location', 'Premium Parking', 'Storage Area', 'Meeting Room Access'],
        reserved_date: '2023-12-15',
        confirmed_date: '2023-12-20',
        setup_date: '2024-03-14',
        breakdown_date: '2024-03-19',
        notes: 'Premium corner booth with excellent visibility. Client requested additional power outlets and WiFi access points.',
        analytics: {
          revenue_generated: 57600,
          visitor_count: 1250,
          lead_conversions: 45,
          satisfaction_score: 4.8,
          utilization_rate: 95,
          setup_efficiency: 92
        },
        timeline: [
          {
            id: '1',
            type: 'confirmation',
            title: 'Booth Confirmed',
            description: 'EcoTech Solutions confirmed booth reservation with full payment',
            date: '2023-12-20T14:30:00Z',
            user: 'Sarah Johnson',
            status: 'completed'
          },
          {
            id: '2',
            type: 'reservation',
            title: 'Booth Reserved',
            description: 'Initial booth reservation with 30% deposit',
            date: '2023-12-15T09:15:00Z',
            user: 'Mike Chen',
            status: 'completed'
          },
          {
            id: '3',
            type: 'setup',
            title: 'Setup Scheduled',
            description: 'Booth setup scheduled for March 14th, 8:00 AM',
            date: '2024-01-10T16:00:00Z',
            user: 'Operations Team',
            status: 'pending'
          }
        ]
      };

      setBoothData(mockBoothData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load booth data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Available':
        return <Badge className="bg-green-100 text-green-800">Available</Badge>;
      case 'Reserved':
        return <Badge className="bg-yellow-100 text-yellow-800">Reserved</Badge>;
      case 'Confirmed':
        return <Badge className="bg-blue-100 text-blue-800">Confirmed</Badge>;
      case 'Occupied':
        return <Badge className="bg-purple-100 text-purple-800">Occupied</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'reservation': return <Calendar className="h-4 w-4" />;
      case 'confirmation': return <CheckCircle className="h-4 w-4" />;
      case 'setup': return <Settings className="h-4 w-4" />;
      case 'event': return <Activity className="h-4 w-4" />;
      case 'breakdown': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        </div>
      </div>
    );
  }

  if (!boothData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Booth Not Found
            </h3>
            <p className="text-gray-600 mb-4">
              The requested booth could not be found.
            </p>
            <Button onClick={() => navigate('/booths')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Booths
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Custom header for booth detail */}
        <div className="bg-white border-b">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => navigate('/booths')}
                className="flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                
                <div className="text-left">
                  <div className="flex items-center space-x-3">
                    <h1 className="text-2xl font-bold text-gray-900">
                      Booth {boothData.code}
                    </h1>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{boothData.zone}</Badge>
                      {getStatusBadge(boothData.status)}
                      {boothData.is_corner && <Badge variant="outline">Corner</Badge>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end mt-4">
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Booth
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width content area */}
        <div className="px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Booth Overview */}
            <div className="lg:col-span-2 space-y-6">
              {/* Main Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Building2 className="h-5 w-5 mr-2" />
                      Booth Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Size</span>
                        <span className="font-medium">{boothData.size_sqm} sqm</span>
                      </div>
                      <div className="border-t pt-2" />
                      <div className="flex justify-between">
                        <span className="text-gray-600">Hall</span>
                        <span className="font-medium">{boothData.hall}</span>
                      </div>
                      <div className="border-t pt-2" />
                      <div className="flex justify-between">
                        <span className="text-gray-600">Aisle</span>
                        <span className="font-medium">{boothData.aisle}</span>
                      </div>
                      <div className="border-t pt-2" />
                      <div className="flex justify-between">
                        <span className="text-gray-600">Price/sqm</span>
                        <span className="font-medium">{formatCurrency(boothData.price_per_meter)}</span>
                      </div>
                      <div className="border-t pt-2" />
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Price</span>
                        <span className="font-medium">{formatCurrency(boothData.total_price)}</span>
                      </div>
                      <div className="border-t pt-2" />
                      <div className="flex justify-between">
                        <span className="text-gray-600">Type</span>
                        <span className="font-medium">{boothData.is_corner ? 'Corner' : 'Standard'}</span>
                      </div>
                    </div>

                    <div className="mt-6">
                      <h4 className="font-medium mb-3">
                        Features & Amenities
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {boothData.features.map((feature, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            <Zap className="h-3 w-3 mr-1" />
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {boothData.notes && (
                      <div className="mt-6">
                        <h4 className="font-medium mb-2">
                          Notes
                        </h4>
                        <p className="text-gray-600 text-sm">{boothData.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Client Information */}
                {boothData.client && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Users className="h-5 w-5 mr-2" />
                        Client Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Company</span>
                          <span className="font-medium">{boothData.client.name}</span>
                        </div>
                        <div className="border-t pt-2" />
                        <div className="flex justify-between">
                          <span className="text-gray-600">Contact Person</span>
                          <span className="font-medium">{boothData.client.contact_person}</span>
                        </div>
                        <div className="border-t pt-2" />
                        <div className="flex justify-between">
                          <span className="text-gray-600">Email</span>
                          <span className="font-medium">{boothData.client.email}</span>
                        </div>
                        <div className="border-t pt-2" />
                        <div className="flex justify-between">
                          <span className="text-gray-600">Phone</span>
                          <span className="font-medium">{boothData.client.phone}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar Info */}
              <div className="space-y-6">
                {/* Status & Dates */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="h-5 w-5 mr-2" />
                      Status & Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Current Status</span>
                        {getStatusBadge(boothData.status)}
                      </div>
                      <div className="border-t pt-2" />
                      {boothData.reserved_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Reserved Date</span>
                          <span className="font-medium">{new Date(boothData.reserved_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {boothData.confirmed_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Confirmed Date</span>
                          <span className="font-medium">{new Date(boothData.confirmed_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {boothData.expo && (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Exhibition</span>
                            <span className="font-medium">{boothData.expo.name}</span>
                          </div>
                          <div className="text-sm text-gray-500 text-right">
                            {new Date(boothData.expo.start_date).toLocaleDateString()} - {new Date(boothData.expo.end_date).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Analytics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2" />
                      Performance Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Revenue:</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(boothData.analytics.revenue_generated)}
                        </span>
                      </div>
                      <div className="border-t pt-2" />
                      <div className="flex justify-between">
                        <span className="text-gray-600">Visitors:</span>
                        <span className="font-semibold">
                          {boothData.analytics.visitor_count.toLocaleString()}
                        </span>
                      </div>
                      <div className="border-t pt-2" />
                      <div className="flex justify-between">
                        <span className="text-gray-600">Lead Conversions:</span>
                        <span className="font-semibold">
                          {boothData.analytics.lead_conversions}
                        </span>
                      </div>
                      <div className="border-t pt-2" />
                      <div className="flex justify-between">
                        <span className="text-gray-600">Satisfaction:</span>
                        <span className="font-semibold">
                          {boothData.analytics.satisfaction_score}/5.0
                        </span>
                      </div>
                      <div className="border-t pt-2" />
                      <div className="flex justify-between">
                        <span className="text-gray-600">Utilization:</span>
                        <span className="font-semibold">
                          {boothData.analytics.utilization_rate}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Detailed Tabs */}
            <div className="lg:col-span-1">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        Booth Specifications
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Code:</span>
                        <span className="font-medium">{boothData.code}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Size:</span>
                        <span className="font-medium">{boothData.size_sqm} sqm</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Zone:</span>
                        <span className="font-medium">{boothData.zone}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Hall:</span>
                        <span className="font-medium">{boothData.hall}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Aisle:</span>
                        <span className="font-medium">{boothData.aisle}</span>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button variant="outline" className="w-full justify-start">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Booth Details
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <Users className="h-4 w-4 mr-2" />
                        Assign Client
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <Calendar className="h-4 w-4 mr-2" />
                        Schedule Setup
                      </Button>
                      <Button variant="outline" className="w-full justify-start">
                        <FileText className="h-4 w-4 mr-2" />
                        Generate Contract
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="timeline" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        Activity Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {boothData.timeline.map((event) => (
                          <div key={event.id} className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-1">
                              {getEventIcon(event.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-gray-900">{event.title}</p>
                                <p className="text-xs text-gray-500">
                                  {new Date(event.date).toLocaleDateString()}
                                </p>
                              </div>
                              <p className="text-sm text-gray-600">{event.description}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-gray-500">by {event.user}</span>
                                <Badge variant="outline" className="text-xs">
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
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoothDetail;
