import {ActivityTimeline} from './WorkflowWorkspace';
import {all as apiAll,save as apiSave,remove as apiRemove,metadata as apiMetadata} from '@/services/laravelClient';
import {api, money} from '@/crm/api';
import {dealRelations, type DealRelations} from '@/lib/dealRelations';
import React, { useState, useEffect, useRef } from 'react';
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
  Activity as ActivityIcon,
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
  currency?: string;
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

  const { userId, userName } = useUserTracking();

  const loadVersion = useRef(0);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [linked, setLinked] = useState<DealRelations>({schedules:null,commissions:null,documents:null,booth:null});
  const formatAmount = (amount: number) => deal?.currency && Number.isFinite(amount) ? money(amount, deal.currency) : 'Not available';
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
    return () => { loadVersion.current++; };
  }, [id]);

  const loadDealData = async () => {
    const version = ++loadVersion.current;
    try {
      setLoading(true);
      setDeal(null); setClient(null); setExhibition(null);
      setLinked({schedules:null,commissions:null,documents:null,booth:null});

      // Load deal
      const { data: dealData, error: dealError } = await supabase
        .from('deals_2026_01_10_12_00')
        .select('*')
        .eq('id', id)
        .single();

      if (version !== loadVersion.current) return;
      if (dealError) throw dealError;
      setDeal(dealData);
      const details = await api<{relations:Record<string, unknown>}>('records/deals/'+dealData.id);
      const related = dealRelations(dealData.id, details.relations);
      if (dealData.booth_id) {
        try { related.booth = (await api<{data:Record<string, unknown>}>('records/booths/'+dealData.booth_id)).data; }
        catch { related.booth = null; }
      }
      if (version !== loadVersion.current) return;
      setLinked(related);

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

        if (version !== loadVersion.current) return;
        if (!clientError) setClient(clientData);
      }

      // Load exhibition
      if (dealData.exhibition_id) {
        const { data: exhibitionData, error: exhibitionError } = await supabase
          .from('exhibitions_2026_01_10_12_00')
          .select('*')
          .eq('id', dealData.exhibition_id)
          .single();

        if (version !== loadVersion.current) return;
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
      if (version === loadVersion.current) setLoading(false);
    }
  };

  const loadActivities = async()=>{const row=(await apiAll('deals')).find(d=>d.id===id);setActivities(row?.activities||[]);};

  const loadTasks = async()=>{setTasks((await apiAll('tasks')).filter(t=>t.deal_id===id) as any);};

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

      await apiSave('deals',{activities:[newActivity,...activities]},deal.id);
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
              <Button variant="outline" size="sm" onClick={() => navigate('/tasks?create=1')}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Create Task
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/proposals')}>
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
                      <div className="text-lg font-semibold">{String(linked.booth?.name ?? 'Not available')}</div>
                      <div className="text-sm text-gray-600">Booth Code</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-lg font-semibold">{linked.booth?.size_sqm != null ? String(linked.booth.size_sqm)+' sqm' : 'Not available'}</div>
                      <div className="text-sm text-gray-600">Booth Size</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-lg font-semibold">{String(linked.booth?.hall || 'Not specified')}</div>
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
                      {linked.schedules === null ? <p>Payment schedule not available.</p> : linked.schedules.length === 0 ? <p>No payment schedule recorded.</p> : linked.schedules.map(schedule => (
                        <div key={String(schedule.id)} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div><div className="font-medium">{String(schedule.name)}</div><div className="text-sm text-gray-600">Due: {String(schedule.due_date ?? 'Not specified')}</div></div>
                          <div className="text-right"><div className="font-semibold">{schedule.amount == null ? 'Not available' : formatAmount(Number(schedule.amount))}</div><Badge variant="outline">{String(schedule.status ?? 'Unknown')}</Badge></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Commission Preview</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Commission Rate:</span><span className="font-medium">{deal.commission_percentage == null ? 'Not available' : String(deal.commission_percentage)+'%'}</span></div>
                      <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Total Commission:</span><span className="font-semibold text-green-600">{linked.commissions === null ? 'Not available' : linked.commissions.length === 0 ? 'No commission recorded' : linked.commissions.map(row => row.amount == null ? 'Not available' : formatAmount(Number(row.amount))).join(' / ')}</span></div>
                      <Separator />
                      {linked.commissions?.map(row => <div key={String(row.id)} className="flex items-center justify-between text-sm"><span className="text-gray-600">{String(row.name)}</span><span className="font-medium">{String(row.status)}</span></div>)}
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
                    <Button size="sm" onClick={() => navigate('/tasks?create=1')}>
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
                    <Button size="sm" onClick={()=>navigate('/contracts')}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {linked.documents === null ? <p>Documents not available.</p> : linked.documents.length === 0 ? <p>No documents recorded for this deal.</p> : linked.documents.map(document => (
                      <div key={String(document.id)} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3"><FileText className="h-8 w-8 text-blue-600" /><div><h4 className="font-medium">{String(document.name)}</h4><Badge variant="outline">{String(document.status ?? 'Unknown')}</Badge></div></div>
                        <div className="text-sm text-gray-600">{String(document.created_at ?? '')}</div>
                        <div className="flex items-center space-x-2"><Button variant="outline" size="sm" onClick={()=>navigate('/contracts')}><Eye className="h-4 w-4 mr-1" />View</Button></div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="payments" className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Payment Timeline</h3>
                  <div className="space-y-4">
                    {linked.schedules === null ? <p>Payment schedule not available.</p> : linked.schedules.length === 0 ? <p>No payment schedule recorded.</p> : linked.schedules.map(schedule => (
                      <div key={String(schedule.id)} className="flex items-center justify-between p-4 border-l-4 border-blue-500 bg-blue-50 rounded-r-lg">
                        <div><h4 className="font-medium">{String(schedule.name)}</h4><p className="text-sm text-gray-600">Due: {String(schedule.due_date ?? 'Not specified')}</p></div>
                        <div className="text-right"><div className="font-semibold text-blue-600">{schedule.amount == null ? 'Not available' : formatAmount(Number(schedule.amount))}</div><Badge variant="outline">{String(schedule.status ?? 'Unknown')}</Badge></div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="tickets" className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Support Tickets</h3>
                    <Button size="sm" onClick={() => navigate('/tickets')}>
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
                    <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/clients/' + deal.client_id)}>
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
                  <ActivityIcon className="h-5 w-5" />
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
    {id&&<ActivityTimeline resource="deals" id={id}/>}
    </div>
  );
};

export default DealDetailPage;