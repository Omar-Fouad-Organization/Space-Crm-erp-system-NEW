import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft,
  Edit,
  Plus,
  CheckSquare,
  FileText,
  CreditCard,
  MessageSquare,
  Building2,
  Calendar,
  DollarSign,
  User,
  Clock,
  Target,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  TrendingUp,
  AlertCircle,
  Download,
  Upload,
  Send,
  Eye,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useUserTracking } from '@/hooks/useUserTracking';
import { supabase } from '@/integrations/supabase/client';

interface Deal {
  id: string;
  title: string;
  description: string;
  client_id: string;
  exhibition_id: string;
  deal_type: string;
  deal_value: number;
  status: string;
  stage: string;
  priority: string;
  probability: number;
  created_by: string;
  created_by_name: string;
  assigned_to: string;
  assigned_to_name: string;
  created_at: string;
  updated_at: string;
  notes: string;
  terms_conditions: string;
  special_requirements: string;
  installments: string;
  payment_method: string;
  base_price: number;
  discount_percentage: number;
  tax_percentage: number;
  commission_percentage: number;
  total_amount: number;
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
}

interface Exhibition {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
}

interface Activity {
  id: string;
  deal_id: string;
  type: string;
  description: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

interface Task {
  id: string;
  deal_id: string;
  title: string;
  description: string;
  assigned_to: string;
  assigned_to_name: string;
  due_date: string;
  status: string;
  priority: string;
  created_at: string;
}

const DEAL_STATUSES = [
  { value: 'lead_created', label: 'Lead Created', color: 'bg-gray-100 text-gray-800' },
  { value: 'talking', label: 'Talking', color: 'bg-blue-100 text-blue-800' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled', color: 'bg-purple-100 text-purple-800' },
  { value: 'strategy', label: 'Strategy', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'proposal', label: 'Proposal', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'objection_handling', label: 'Objection Handling', color: 'bg-orange-100 text-orange-800' },
  { value: 'terms_finalized', label: 'Terms Finalized', color: 'bg-green-100 text-green-800' },
  { value: 'closed_won', label: 'Closed - Won', color: 'bg-green-500 text-white' },
  { value: 'closed_lost', label: 'Closed - Lost', color: 'bg-red-500 text-white' },
  { value: 'deal_failed', label: 'Deal Failed', color: 'bg-red-100 text-red-800' },
  { value: 'deal_canceled', label: 'Deal Canceled', color: 'bg-gray-500 text-white' }
];

const DEAL_TYPES = [
  { value: 'booth', label: 'Booth Deal' },
  { value: 'sponsorship', label: 'Sponsor Deal' },
  { value: 'sector_sponsor', label: 'Sector Sponsor Deal' },
  { value: 'expo', label: 'Expo Deal' }
];

const PRIORITIES = [
  { value: 'Low', color: 'bg-gray-100 text-gray-800' },
  { value: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'Critical', color: 'bg-red-100 text-red-800' }
];

const DealDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { formatAmount } = useCurrency();
  const { userId, userName } = useUserTracking();
  
  const [deal, setDeal] = useState<Deal | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [exhibition, setExhibition] = useState<Exhibition | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');
  
  // Form states for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    status: '',
    priority: '',
    probability: 0,
    notes: ''
  });
  
  // New note state
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Load deal data
  useEffect(() => {
    if (id) {
      loadDealData();
    }
  }, [id]);

  const loadDealData = async () => {
    try {
      setLoading(true);
      
      // Load deal
      const { data: dealData, error: dealError } = await supabase
        .from('deals_2026_01_10_12_00')
        .select('*')
        .eq('id', id)
        .single();
      
      if (dealError) throw dealError;
      setDeal(dealData);
      
      // Set edit form data
      setEditForm({
        title: dealData.title,
        status: dealData.status,
        priority: dealData.priority,
        probability: dealData.probability,
        notes: dealData.notes || ''
      });
      
      // Load client
      if (dealData.client_id) {
        const { data: clientData, error: clientError } = await supabase
          .from('clients_2026_01_10_12_00')
          .select('*')
          .eq('id', dealData.client_id)
          .single();
        
        if (!clientError) setClient(clientData);
      }
      
      // Load exhibition
      if (dealData.exhibition_id) {
        const { data: exhibitionData, error: exhibitionError } = await supabase
          .from('exhibitions_2026_01_10_12_00')
          .select('*')
          .eq('id', dealData.exhibition_id)
          .single();
        
        if (!exhibitionError) setExhibition(exhibitionData);
      }
      
      // Load activities (notes and system activities)
      loadActivities();
      
      // Load tasks
      loadTasks();
      
    } catch (error: any) {
      console.error('Error loading deal:', error);
      toast({
        title: "Error Loading Deal",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    try {
      // For now, we'll create mock activities since the table might not exist
      // In a real implementation, you'd load from an activities table
      const mockActivities: Activity[] = [
        {
          id: '1',
          deal_id: id!,
          type: 'note',
          description: 'Initial contact made with client. They showed interest in booth space.',
          created_by: 'demo-user',
          created_by_name: 'Demo User',
          created_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
        },
        {
          id: '2',
          deal_id: id!,
          type: 'status_change',
          description: 'Deal status changed from "Lead Created" to "Talking"',
          created_by: 'system',
          created_by_name: 'System',
          created_at: new Date(Date.now() - 43200000).toISOString() // 12 hours ago
        }
      ];
      
      setActivities(mockActivities);
    } catch (error: any) {
      console.error('Error loading activities:', error);
    }
  };

  const loadTasks = async () => {
    try {
      // Mock tasks for demonstration
      const mockTasks: Task[] = [
        {
          id: '1',
          deal_id: id!,
          title: 'Follow up call',
          description: 'Call client to discuss booth requirements',
          assigned_to: userId || 'demo-user',
          assigned_to_name: userName || 'Demo User',
          due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
          status: 'pending',
          priority: 'High',
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          deal_id: id!,
          title: 'Send proposal',
          description: 'Prepare and send detailed proposal with pricing',
          assigned_to: userId || 'demo-user',
          assigned_to_name: userName || 'Demo User',
          due_date: new Date(Date.now() + 172800000).toISOString().split('T')[0], // Day after tomorrow
          status: 'pending',
          priority: 'Medium',
          created_at: new Date().toISOString()
        }
      ];
      
      setTasks(mockTasks);
    } catch (error: any) {
      console.error('Error loading tasks:', error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!deal) return;
    
    try {
      setUpdating(true);
      
      const { error } = await supabase
        .from('deals_2026_01_10_12_00')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', deal.id);
      
      if (error) throw error;
      
      setDeal(prev => prev ? { ...prev, status: newStatus } : null);
      
      // Add activity log
      const newActivity: Activity = {
        id: Date.now().toString(),
        deal_id: deal.id,
        type: 'status_change',
        description: `Deal status changed to "${DEAL_STATUSES.find(s => s.value === newStatus)?.label}"`,
        created_by: userId || 'demo-user',
        created_by_name: userName || 'Demo User',
        created_at: new Date().toISOString()
      };
      
      setActivities(prev => [newActivity, ...prev]);
      
      toast({
        title: "Status Updated",
        description: `Deal status changed to ${DEAL_STATUSES.find(s => s.value === newStatus)?.label}`,
      });
      
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        title: "Error Updating Status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!deal) return;
    
    try {
      setUpdating(true);
      
      const { error } = await supabase
        .from('deals_2026_01_10_12_00')
        .update({
          title: editForm.title,
          status: editForm.status,
          priority: editForm.priority,
          probability: editForm.probability,
          notes: editForm.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', deal.id);
      
      if (error) throw error;
      
      setDeal(prev => prev ? {
        ...prev,
        title: editForm.title,
        status: editForm.status,
        priority: editForm.priority,
        probability: editForm.probability,
        notes: editForm.notes
      } : null);
      
      setIsEditing(false);
      
      toast({
        title: "Deal Updated",
        description: "Deal information has been updated successfully",
      });
      
    } catch (error: any) {
      console.error('Error updating deal:', error);
      toast({
        title: "Error Updating Deal",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !deal) return;
    
    try {
      setAddingNote(true);
      
      const newActivity: Activity = {
        id: Date.now().toString(),
        deal_id: deal.id,
        type: 'note',
        description: newNote.trim(),
        created_by: userId || 'demo-user',
        created_by_name: userName || 'Demo User',
        created_at: new Date().toISOString()
      };
      
      setActivities(prev => [newActivity, ...prev]);
      setNewNote('');
      
      toast({
        title: "Note Added",
        description: "Your note has been added to the deal timeline",
      });
      
    } catch (error: any) {
      console.error('Error adding note:', error);
      toast({
        title: "Error Adding Note",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-gray-600">Loading deal details...</p>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">Deal Not Found</h2>
          <p className="text-gray-600">The deal you're looking for doesn't exist or has been deleted.</p>
          <Button onClick={() => navigate('/deals')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Deals
          </Button>
        </div>
      </div>
    );
  }

  const currentStatus = DEAL_STATUSES.find(s => s.value === deal.status);
  const currentPriority = PRIORITIES.find(p => p.value === deal.priority);
  const dealType = DEAL_TYPES.find(dt => dt.value === deal.deal_type);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/deals')}
                className="text-[#1C2434]"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Deals
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-xl font-semibold text-[#1C2434]">{deal.title}</h1>
                  <div className="flex items-center space-x-4 mt-1">
                    <Select value={deal.status} onValueChange={handleStatusChange}>
                      <SelectTrigger className="w-48 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEAL_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-lg font-semibold text-green-600">
                      {formatAmount(deal.total_amount || deal.deal_value)}
                    </div>
                    <Badge className={currentPriority?.color}>
                      {deal.priority}
                    </Badge>
                    <div className="text-sm text-gray-600">
                      Assigned to: {deal.assigned_to_name}
                    </div>
                    {exhibition && (
                      <div className="text-sm text-gray-600">
                        Expo: {exhibition.name}
                      </div>
                    )}
                    <div className="text-sm text-gray-500">
                      Updated: {new Date(deal.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
                className="border-[#E4E7EC] text-[#1C2434]"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Deal
              </Button>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
              <Button variant="outline" size="sm">
                <CheckSquare className="h-4 w-4 mr-2" />
                Create Task
              </Button>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Generate Proposal
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Deal Core Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Briefcase className="h-5 w-5" />
                  <span>Deal Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="title">Deal Title</Label>
                        <Input
                          id="title"
                          value={editForm.title}
                          onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                          className="border-[#E4E7EC] focus:border-[#2BB0E6]"
                        />
                      </div>
                      <div>
                        <Label htmlFor="status">Status</Label>
                        <Select value={editForm.status} onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DEAL_STATUSES.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="priority">Priority</Label>
                        <Select value={editForm.priority} onValueChange={(value) => setEditForm(prev => ({ ...prev, priority: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((priority) => (
                              <SelectItem key={priority.value} value={priority.value}>
                                {priority.value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="probability">Probability (%)</Label>
                        <Input
                          id="probability"
                          type="number"
                          value={editForm.probability}
                          onChange={(e) => setEditForm(prev => ({ ...prev, probability: parseInt(e.target.value) || 0 }))}
                          className="border-[#E4E7EC] focus:border-[#2BB0E6]"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={editForm.notes}
                        onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                        className="border-[#E4E7EC] focus:border-[#2BB0E6]"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button onClick={handleSaveEdit} disabled={updating}>
                        {updating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        className="border-[#E4E7EC] text-[#1C2434]"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Client:</span>
                        <span className="font-medium">
                          {client?.name || 'Unknown Client'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Briefcase className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Deal Type:</span>
                        <span className="font-medium">{dealType?.label}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Target className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Probability:</span>
                        <span className="font-medium">{deal.probability}%</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Expected Close:</span>
                        <span className="font-medium">Not set</span>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Created by:</span>
                        <span className="font-medium">{deal.created_by_name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Created:</span>
                        <span className="font-medium">{new Date(deal.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">Deal Code:</span>
                        <span className="font-medium">{deal.id.slice(0, 8).toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                )}
                {deal.description && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                    <p className="text-gray-700">{deal.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dynamic Deal Type Section */}
            {deal.deal_type === 'booth' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Building2 className="h-5 w-5" />
                    <span>Booth Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-lg font-semibold">A-101</div>
                      <div className="text-sm text-gray-600">Booth Code</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-lg font-semibold">36 sqm</div>
                      <div className="text-sm text-gray-600">Booth Size</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-lg font-semibold">Hall 1</div>
                      <div className="text-sm text-gray-600">Location</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Plan & Commission */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Payment Plan & Commission</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Payment Schedule</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">30% Upfront</div>
                          <div className="text-sm text-gray-600">Due: Immediately</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {formatAmount((deal.total_amount || deal.deal_value) * 0.3)}
                          </div>
                          <Badge variant="outline">Pending</Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">40% After 6 months</div>
                          <div className="text-sm text-gray-600">
                            Due: {new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {formatAmount((deal.total_amount || deal.deal_value) * 0.4)}
                          </div>
                          <Badge variant="outline">Scheduled</Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">30% After 9 months</div>
                          <div className="text-sm text-gray-600">
                            Due: {new Date(Date.now() + 9 * 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {formatAmount((deal.total_amount || deal.deal_value) * 0.3)}
                          </div>
                          <Badge variant="outline">Scheduled</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Commission Preview</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Commission Rate:</span>
                        <span className="font-medium">{deal.commission_percentage || 5}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Total Commission:</span>
                        <span className="font-semibold text-green-600">
                          {formatAmount(((deal.total_amount || deal.deal_value) * (deal.commission_percentage || 5)) / 100)}
                        </span>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Per 1st Payment:</span>
                          <span className="font-medium">{formatAmount(((deal.total_amount || deal.deal_value) * 0.3 * (deal.commission_percentage || 5)) / 100)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Per 2nd Payment:</span>
                          <span className="font-medium">{formatAmount(((deal.total_amount || deal.deal_value) * 0.4 * (deal.commission_percentage || 5)) / 100)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Per 3rd Payment:</span>
                          <span className="font-medium">{formatAmount(((deal.total_amount || deal.deal_value) * 0.3 * (deal.commission_percentage || 5)) / 100)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs Section */}
            <Card>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="tasks">
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Tasks
                  </TabsTrigger>
                  <TabsTrigger value="documents">
                    <FileText className="h-4 w-4 mr-2" />
                    Documents
                  </TabsTrigger>
                  <TabsTrigger value="payments">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Payments
                  </TabsTrigger>
                  <TabsTrigger value="tickets">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Tickets
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="tasks" className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Tasks</h3>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <CheckSquare className="h-4 w-4 text-gray-400" />
                            <div>
                              <h4 className="font-medium">{task.title}</h4>
                              <p className="text-sm text-gray-600">{task.description}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Due: {new Date(task.due_date).toLocaleDateString()} • Assigned to: {task.assigned_to_name}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={task.priority === 'High' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                            {task.priority}
                          </Badge>
                          <Badge variant="outline">{task.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Documents</h3>
                    <Button size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8 text-blue-600" />
                        <div>
                          <h4 className="font-medium">Proposal_v1.pdf</h4>
                          <Badge variant="outline">Sent</Badge>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        Sent on {new Date().toLocaleDateString()}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8 text-green-600" />
                        <div>
                          <h4 className="font-medium">Contract_Draft.pdf</h4>
                          <Badge variant="outline">Draft</Badge>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        Created on {new Date().toLocaleDateString()}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          <Send className="h-4 w-4 mr-1" />
                          Send
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="payments" className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Payment Timeline</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border-l-4 border-blue-500 bg-blue-50 rounded-r-lg">
                      <div>
                        <h4 className="font-medium">First Payment (30%)</h4>
                        <p className="text-sm text-gray-600">Due immediately upon contract signing</p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-blue-600">
                          {formatAmount((deal.total_amount || deal.deal_value) * 0.3)}
                        </div>
                        <Badge variant="outline">Pending</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 border-l-4 border-yellow-500 bg-yellow-50 rounded-r-lg">
                      <div>
                        <h4 className="font-medium">Second Payment (40%)</h4>
                        <p className="text-sm text-gray-600">Due 6 months after first payment</p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-yellow-600">
                          {formatAmount((deal.total_amount || deal.deal_value) * 0.4)}
                        </div>
                        <Badge variant="outline">Scheduled</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 border-l-4 border-green-500 bg-green-50 rounded-r-lg">
                      <div>
                        <h4 className="font-medium">Final Payment (30%)</h4>
                        <p className="text-sm text-gray-600">Due 9 months after first payment</p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">
                          {formatAmount((deal.total_amount || deal.deal_value) * 0.3)}
                        </div>
                        <Badge variant="outline">Scheduled</Badge>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="tickets" className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Support Tickets</h3>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Ticket
                    </Button>
                  </div>
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No support tickets linked to this deal yet.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Right Column - Activity & History */}
          <div className="space-y-6">
            {/* Client Information */}
            {client && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Building2 className="h-5 w-5" />
                    <span>Client Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium">{client.name}</h4>
                      <p className="text-sm text-gray-600">{client.company}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{client.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">{client.phone}</span>
                    </div>
                    {client.address && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{client.address}</span>
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="w-full">
                      View Client Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Add Note */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Plus className="h-5 w-5" />
                  <span>Add Note</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Textarea
                    placeholder="Add a note about this deal..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                    className="border-[#E4E7EC] focus:border-[#2BB0E6]"
                  />
                  <Button onClick={handleAddNote} disabled={addingNote} className="w-full">
                    {addingNote ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      'Add Note'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Activity Timeline</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activities.map((activity, index) => (
                    <div key={activity.id} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2">
                        {index < activities.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-200 mx-auto mt-2"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {activity.created_by_name} • {new Date(activity.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealDetailPage;