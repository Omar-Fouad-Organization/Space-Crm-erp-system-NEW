import {all as apiAll} from '@/services/laravelClient';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  Building,
  Users,
  MapPin,
  Calendar,
  Phone,
  Mail,
  Globe,
  RefreshCw,
  Download,
  Filter,
  Search,
  Eye,
  Edit,
  Plus,
  Star,
  TrendingUp,
  DollarSign,
  Award,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface Exhibitor {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  website?: string;
  industry: string;
  company_size: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  status: 'active' | 'inactive' | 'pending' | 'blacklisted';
  rating: number;
  total_exhibitions: number;
  total_spent: number;
  last_exhibition: string;
  next_exhibition?: string;
  booth_preferences: string[];
  special_requirements?: string;
  created_at: string;
  notes?: string;
}

const industries = [
  'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail',
  'Education', 'Energy', 'Transportation', 'Real Estate', 'Food & Beverage'
];

const companySizes = [
  { value: 'startup', label: 'Startup (1-10)', color: 'bg-purple-100 text-purple-800' },
  { value: 'small', label: 'Small (11-50)', color: 'bg-blue-100 text-blue-800' },
  { value: 'medium', label: 'Medium (51-200)', color: 'bg-green-100 text-green-800' },
  { value: 'large', label: 'Large (201-1000)', color: 'bg-orange-100 text-orange-800' },
  { value: 'enterprise', label: 'Enterprise (1000+)', color: 'bg-red-100 text-red-800' }
];

const exhibitorStatuses = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-800', icon: Clock },
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  { value: 'blacklisted', label: 'Blacklisted', color: 'bg-red-100 text-red-800', icon: AlertTriangle }
];

export default function Exhibitors() {
  const { toast } = useToast();
  const { formatAmount } = useCurrency();
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');

  // Mock data
  const mockExhibitors: Exhibitor[] = [
    {
      id: '1',
      company_name: 'EcoTech Solutions',
      contact_person: 'John Smith',
      email: 'john.smith@ecotech.com',
      phone: '+1-555-0101',
      website: 'https://ecotech.com',
      industry: 'Technology',
      company_size: 'medium',
      status: 'active',
      rating: 4.8,
      total_exhibitions: 12,
      total_spent: 285000,
      last_exhibition: '2024-01-15',
      next_exhibition: '2024-03-15',
      booth_preferences: ['Premium Location', 'Corner Booth', 'Large Space'],
      special_requirements: 'High power requirements for demo equipment',
      created_at: '2022-03-15T10:00:00Z',
      notes: 'Excellent exhibitor, always pays on time, great booth presentation'
    },
    {
      id: '2',
      company_name: 'Green Energy Alliance',
      contact_person: 'Sarah Wilson',
      email: 'sarah.wilson@greenenergy.com',
      phone: '+1-555-0102',
      website: 'https://greenenergy.com',
      industry: 'Energy',
      company_size: 'large',
      status: 'active',
      rating: 4.6,
      total_exhibitions: 8,
      total_spent: 420000,
      last_exhibition: '2024-01-10',
      next_exhibition: '2024-04-20',
      booth_preferences: ['Premium Location', 'High Traffic Area'],
      created_at: '2022-06-20T14:30:00Z',
      notes: 'Major sponsor, prefers platinum packages'
    },
    {
      id: '3',
      company_name: 'Innovation Corp',
      contact_person: 'Michael Chen',
      email: 'michael.chen@innovation.com',
      phone: '+1-555-0103',
      industry: 'Technology',
      company_size: 'startup',
      status: 'pending',
      rating: 4.2,
      total_exhibitions: 3,
      total_spent: 45000,
      last_exhibition: '2023-11-15',
      booth_preferences: ['Standard Location', 'Budget Friendly'],
      created_at: '2023-08-10T09:15:00Z',
      notes: 'New exhibitor, needs guidance on booth setup'
    },
    {
      id: '4',
      company_name: 'Sustainable Systems Inc',
      contact_person: 'Emily Rodriguez',
      email: 'emily.rodriguez@sustainable.com',
      phone: '+1-555-0104',
      website: 'https://sustainable.com',
      industry: 'Manufacturing',
      company_size: 'medium',
      status: 'active',
      rating: 4.9,
      total_exhibitions: 15,
      total_spent: 380000,
      last_exhibition: '2024-01-08',
      next_exhibition: '2024-05-10',
      booth_preferences: ['Eco-Friendly Setup', 'Premium Location'],
      special_requirements: 'Sustainable materials only, no plastic displays',
      created_at: '2021-11-30T16:45:00Z',
      notes: 'Long-term partner, sustainability focused'
    },
    {
      id: '5',
      company_name: 'Future Tech Ltd',
      contact_person: 'David Brown',
      email: 'david.brown@futuretech.com',
      phone: '+1-555-0105',
      industry: 'Technology',
      company_size: 'small',
      status: 'inactive',
      rating: 3.8,
      total_exhibitions: 5,
      total_spent: 125000,
      last_exhibition: '2023-09-20',
      booth_preferences: ['Standard Location'],
      created_at: '2023-01-15T11:20:00Z',
      notes: 'Has not participated in recent exhibitions'
    }
  ];

  useEffect(() => {
    loadExhibitors();
  }, []);

  const loadExhibitors = async()=>{setLoading(true);try{const [clients,deals,expos]=await Promise.all([apiAll('clients'),apiAll('deals'),apiAll('exhibitions')]);setExhibitors(clients.map(client=>{const linked=deals.filter(d=>d.client_id===client.id),events=expos.filter(e=>linked.some(d=>d.exhibition_id===e.id)),today=new Date().toISOString().slice(0,10),past=events.filter(e=>e.end_date<today).sort((a,b)=>b.end_date.localeCompare(a.end_date)),next=events.filter(e=>e.start_date>=today).sort((a,b)=>a.start_date.localeCompare(b.start_date));return{id:client.id,company_name:client.company||client.name,contact_person:client.contact_person||'',email:client.email||'',phone:client.phone||'N/A',website:client.website,industry:client.industry||'N/A',company_size:({'1-10':'startup','11-50':'small','51-200':'medium','201-500':'large','501-1000':'large','1000+':'enterprise'} as any)[client.company_size]||client.company_size||'',status:client.status==='Inactive'?'inactive':linked.length?'active':'pending',rating:Number(client.rating||0),total_exhibitions:events.length,total_spent:linked.filter(d=>d.status==='Closed Won'&&d.currency==='EGP').reduce((n,d)=>n+Number(d.deal_value),0),last_exhibition:past[0]?.end_date||'',next_exhibition:next[0]?.start_date,booth_preferences:client.booth_preferences||[],special_requirements:client.special_requirements||'',created_at:client.created_at,notes:client.notes||''};}) as Exhibitor[]);}catch(error){setExhibitors([]);toast({title:'Exhibitors unavailable',description:(error as Error).message,variant:'destructive'});}finally{setLoading(false);}};

  const filteredExhibitors = exhibitors.filter(exhibitor => {
    const matchesSearch = exhibitor.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exhibitor.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         exhibitor.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || exhibitor.status === statusFilter;
    const matchesIndustry = industryFilter === 'all' || exhibitor.industry === industryFilter;
    const matchesSize = sizeFilter === 'all' || exhibitor.company_size === sizeFilter;

    return matchesSearch && matchesStatus && matchesIndustry && matchesSize;
  });

  const getStatusConfig = (status: string) => {
    return exhibitorStatuses.find(s => s.value === status) || exhibitorStatuses[0];
  };

  const getSizeConfig = (size: string) => {
    return companySizes.find(s => s.value === size) || {value:'',label:'Not specified',color:'bg-gray-100 text-gray-800'};
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating)
            ? 'text-yellow-400 fill-current'
            : i < rating
            ? 'text-yellow-400 fill-current opacity-50'
            : 'text-gray-300'
        }`}
      />
    ));
  };

  // Calculate summary statistics
  const totalExhibitors = exhibitors.length;
  const activeExhibitors = exhibitors.filter(e => e.status === 'active').length;
  const totalRevenue = exhibitors.reduce((sum, e) => sum + e.total_spent, 0);
  const avgRating = exhibitors.reduce((sum, e) => sum + e.rating, 0) / exhibitors.length || 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading exhibitors...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">

          <div>

            <h1 className="text-3xl font-bold tracking-tight">

              <Building className="inline-block h-8 w-8 mr-3 text-blue-600" />
              Exhibitor Relations
            </h1>

            <p className="text-muted-foreground mt-2">
              Manage exhibitor relationships and partnerships
            </p>

          </div>

          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export List
            </Button>
            <Button onClick={loadExhibitors} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Exhibitor
            </Button>
          </div>

        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">

                <Building className="h-4 w-4 text-blue-600" />

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Exhibitors
                  </p>
                  <p className="text-2xl font-bold">
                    {totalExhibitors}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Registered companies
                  </p>
                </div>

                <div className="ml-auto">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>

              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">

                <CheckCircle className="h-4 w-4 text-green-600" />

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Active
                  </p>
                  <p className="text-2xl font-bold">
                    {activeExhibitors}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {((activeExhibitors / totalExhibitors) * 100).toFixed(1)}% active
                  </p>
                </div>

                <div className="ml-auto">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>

              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">

                <DollarSign className="h-4 w-4 text-green-600" />

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold">
                    {formatAmount(totalRevenue)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Lifetime value
                  </p>
                </div>

                <div className="ml-auto">
                  <Award className="h-4 w-4 text-green-600" />
                </div>

              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">

                <Star className="h-4 w-4 text-yellow-600" />

                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Avg Rating
                  </p>
                  <p className="text-2xl font-bold">
                    {avgRating.toFixed(1)}
                  </p>
                  <div className="flex items-center space-x-1">
                    {renderStars(avgRating)}
                  </div>
                </div>

                <div className="ml-auto">
                  <Award className="h-4 w-4 text-yellow-600" />
                </div>

              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">

              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search exhibitors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <select
                className="px-3 py-2 border border-gray-300 rounded-md"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                {exhibitorStatuses.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
              <select
                className="px-3 py-2 border border-gray-300 rounded-md"
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
              >
                <option value="all">All Industries</option>
                {industries.map(industry => (
                  <option key={industry} value={industry}>{industry}</option>
                ))}
              </select>
              <select
                className="px-3 py-2 border border-gray-300 rounded-md"
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
              >
                <option value="all">All Sizes</option>
                {companySizes.map(size => (
                  <option key={size.value} value={size.value}>{size.label}</option>
                ))}
              </select>
            </div>

          </CardContent>
        </Card>

        {/* Exhibitors List */}
        <div className="space-y-4">

          {filteredExhibitors.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No exhibitors found
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || statusFilter !== 'all' || industryFilter !== 'all' || sizeFilter !== 'all'
                    ? 'Try adjusting your search criteria or filters.'
                    : 'Get started by adding your first exhibitor.'}
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Exhibitor
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredExhibitors.map((exhibitor) => {
              const statusConfig = getStatusConfig(exhibitor.status);
              const sizeConfig = getSizeConfig(exhibitor.company_size);
              const StatusIcon = statusConfig.icon;
              return (
                <Card key={exhibitor.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-6">

                      <div className="flex items-start justify-between mb-4">

                        <div className="flex items-center space-x-3">

                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <Building className="h-6 w-6 text-blue-600" />
                          </div>

                          <div>

                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="text-xl font-semibold">{exhibitor.company_name}</h3>
                              <Badge className={statusConfig.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                              <Badge className={sizeConfig.color}>
                                {sizeConfig.label}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">

                            <div className="space-y-2">

                              <div className="flex items-center space-x-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {exhibitor.contact_person}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  {exhibitor.email}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  {exhibitor.phone}
                                </span>
                              </div>

                            </div>

                            <div className="space-y-2">

                              <div className="flex items-center space-x-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  {exhibitor.industry}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  {exhibitor.total_exhibitions} exhibitions
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">
                                  {formatAmount(exhibitor.total_spent)} spent
                                </span>
                              </div>

                            </div>

                            <div className="space-y-2">

                              <div className="flex items-center space-x-2">
                                <Star className="h-4 w-4 text-muted-foreground" />
                                Rating:
                                <div className="flex items-center space-x-1">
                                  {renderStars(exhibitor.rating)}
                                  <span className="text-sm font-medium">
                                    {exhibitor.rating.toFixed(1)}
                                  </span>
                                </div>
                              </div>

                              <div className="text-sm text-muted-foreground">
                                Last: {exhibitor.last_exhibition?new Date(exhibitor.last_exhibition).toLocaleDateString():'N/A'}
                              </div>

                              {exhibitor.next_exhibition && (
                                <div className="text-sm text-muted-foreground">
                                  Next: {new Date(exhibitor.next_exhibition).toLocaleDateString()}
                                </div>
                              )}
                            </div>

                          </div>

                          {exhibitor.booth_preferences.length > 0 && (
                            <div className="mt-4">
                              <span className="text-sm font-medium">Booth Preferences:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {exhibitor.booth_preferences.map((pref, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {pref}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {exhibitor.special_requirements && (
                            <div className="mt-3">
                              <span className="text-sm font-medium">Special Requirements:</span>
                              <p className="text-sm text-muted-foreground mt-1">{exhibitor.special_requirements}</p>
                            </div>
                          )}
                          {exhibitor.notes && (
                            <div className="mt-3">
                              <span className="text-sm font-medium">Notes:</span>
                              <p className="text-sm text-muted-foreground mt-1">{exhibitor.notes}</p>
                            </div>
                          )}
                        </div>

                      </div>

                      <div className="flex items-center justify-end space-x-2">
                        {exhibitor.website && (
                          <Button variant="outline" size="sm">
                            <Globe className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>

                    </div>

                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

      </div>

    </div>

  );
}