import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { dealService, clientService, taskService, expoService } from "@/services/supabaseService";
import CreateDealDialog from "@/components/forms/CreateDealDialog";
import ComprehensiveDealForm from "@/components/forms/ComprehensiveDealForm";
import { useCurrency } from '@/contexts/CurrencyContext';
import { DeleteConfirmationDialog } from '@/components/ui/DeleteConfirmationDialog';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  Target,
  Plus,
  Search,
  Filter,
  Calendar,
  DollarSign,
  User,
  Building2,
  Phone,
  Mail,
  FileText,
  Clock,
  TrendingUp,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  MessageSquare,
  Star,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Zap,
  Users,
  MapPin,
  Globe,
  Activity,
  PieChart,
  BarChart3,
  Calculator,
  CreditCard,
  Bell,
  Flag,
  Bookmark,
  Share2,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Enhanced Pipeline Stages with SPACE-specific workflow
const PIPELINE_STAGES = [
  {
    id: 'talking',
    name: 'Talking',
    color: '#7B8FA1',
    description: 'Initial contact and discovery',
    icon: MessageSquare,
    actions: ['Schedule Meeting', 'Send Info', 'Add Note']
  },
  {
    id: 'meeting_scheduled',
    name: 'Meeting Scheduled',
    color: '#2BB0E6',
    description: 'Meeting arranged with prospect',
    icon: Calendar,
    actions: ['Confirm Meeting', 'Prepare Agenda', 'Send Reminder']
  },
  {
    id: 'strategy_proposal',
    name: 'Strategy Proposal',
    color: '#5FB3A2',
    description: 'Proposal sent and under review',
    icon: FileText,
    actions: ['Follow Up', 'Modify Proposal', 'Schedule Review']
  },
  {
    id: 'objection_handling',
    name: 'Objection Handling',
    color: '#9CA3AF',
    description: 'Addressing concerns and questions',
    icon: AlertCircle,
    actions: ['Address Concerns', 'Provide Clarification', 'Negotiate Terms']
  },
  {
    id: 'terms_finalized',
    name: 'Terms Finalized',
    color: '#2BB0E6',
    description: 'Agreement on terms and conditions',
    icon: CheckCircle,
    actions: ['Prepare Contract', 'Legal Review', 'Schedule Signing']
  },
  {
    id: 'closed_won',
    name: 'Closed Won',
    color: '#5FB3A2',
    description: 'Deal successfully closed',
    icon: Star,
    actions: ['Setup Payment', 'Onboard Client', 'Celebrate']
  },
  {
    id: 'closed_lost',
    name: 'Closed Lost',
    color: '#B97A7A',
    description: 'Deal lost to competitor or cancelled',
    icon: Trash2,
    actions: ['Analyze Loss', 'Future Opportunity', 'Archive']
  },
  {
    id: 'canceled',
    name: 'Canceled',
    color: '#9CA3AF',
    description: 'Deal cancelled by prospect',
    icon: Flag,
    actions: ['Document Reason', 'Future Follow-up', 'Archive']
  },
];

interface DealNote {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  type: 'note' | 'call' | 'meeting' | 'email';
}

interface PaymentSchedule {
  id: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  description: string;
}

interface Commission {
  user_id: string;
  user_name: string;
  percentage: number;
  amount: number;
  status: 'pending' | 'approved' | 'paid';
}

const Deals = () => {
  const { toast } = useToast();
  const { formatAmount } = useCurrency();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState([]);
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [showDealDetails, setShowDealDetails] = useState(false);
  const [dealNotes, setDealNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [paymentSchedule, setPaymentSchedule] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [editingDeal, setEditingDeal] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [dealToDelete, setDealToDelete] = useState(null);
  const [expos, setExpos] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    console.log('🔄 Loading deals data...');
    setLoading(true);
    try {
      const [dealsData, clientsData, tasksData, exposData] = await Promise.all([
        dealService.getAll(),
        clientService.getAll(),
        taskService.getAll(),
        expoService.getAll()
      ]);
      
      // Transform deals to match pipeline stages
      const transformedDeals = (dealsData || []).map(deal => ({
        ...deal,
        stage: deal.stage || 'talking',
        value: deal.deal_value || 0,
        client_name: deal.client_name || clientsData?.find(c => c.id === deal.client_id)?.name || 'Unknown Client',
        client_info: clientsData?.find(c => c.id === deal.client_id) || {},
        priority: deal.priority || 'Medium',
        last_activity: deal.updated_at || deal.created_at,
        notes: deal.notes || '',
        probability: calculateProbability(deal.status),
        days_in_stage: calculateDaysInStage(deal.updated_at),
        next_action: getNextAction(deal.status),
        health_score: calculateHealthScore(deal),
      }));

      console.log('📊 Loaded', transformedDeals.length, 'deals for UI');
      
      setDeals(transformedDeals);
      setClients(clientsData || []);
      setExpos(exposData || []);
      setTasks(tasksData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load deals data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const mapStatusToStage = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'Talking': 'talking',
      'Meeting Scheduled': 'meeting_scheduled',
      'Proposal': 'strategy_proposal',
      'Negotiation': 'objection_handling',
      'Contract': 'terms_finalized',
      'Closed Won': 'closed_won',
      'Closed Lost': 'closed_lost',
      'Canceled': 'canceled',
    };
    return statusMap[status] || 'talking';
  };

  const mapStageToStatus = (stage: string) => {
    const stageMap: { [key: string]: string } = {
      'talking': 'Talking',
      'meeting_scheduled': 'Meeting Scheduled',
      'strategy_proposal': 'Proposal',
      'objection_handling': 'Negotiation',
      'terms_finalized': 'Contract',
      'closed_won': 'Closed Won',
      'closed_lost': 'Closed Lost',
      'canceled': 'Canceled',
    };
    return stageMap[stage] || 'Talking';
  };

  const calculateProbability = (status: string) => {
    const probabilities: { [key: string]: number } = {
      'Talking': 10,
      'Meeting Scheduled': 25,
      'Proposal': 40,
      'Negotiation': 60,
      'Contract': 80,
      'Closed Won': 100,
      'Closed Lost': 0,
      'Canceled': 0,
    };
    return probabilities[status] || 10;
  };

  const calculateDaysInStage = (lastUpdate: string) => {
    if (!lastUpdate) return 0;
    const now = new Date();
    const updated = new Date(lastUpdate);
    const diffTime = Math.abs(now.getTime() - updated.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getNextAction = (status: string) => {
    const actions: { [key: string]: string } = {
      'Talking': 'Schedule initial meeting',
      'Meeting Scheduled': 'Prepare meeting agenda',
      'Proposal': 'Follow up on proposal',
      'Negotiation': 'Address client concerns',
      'Contract': 'Finalize contract terms',
      'Closed Won': 'Begin onboarding process',
      'Closed Lost': 'Conduct loss analysis',
      'Canceled': 'Archive and document',
    };
    return actions[status] || 'Update deal status';
  };

  const calculateHealthScore = (deal: any) => {
    let score = 50; // Base score
    
    if (deal) {
      // Factor in time in stage
      const daysInStage = calculateDaysInStage(deal.updated_at);
      if (daysInStage > 30) score -= 20;
      else if (daysInStage > 14) score -= 10;
      
      // Factor in deal value
      if (deal.value > 100000) score += 20;
      else if (deal.value > 50000) score += 10;
      
      // Factor in client engagement
      if (deal.priority === 'High') score += 15;
      else if (deal.priority === 'Low') score -= 10;
    }
    
    return Math.max(0, Math.min(100, score));
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const dealId = draggableId;
    const newStage = destination.droppableId;
    const newStatus = mapStageToStatus(newStage);

    console.log('🔄 Drag and drop - updating deal:', {
      dealId,
      newStage,
      newStatus,
      from: source.droppableId,
      to: destination.droppableId
    });

    try {
      // Update both stage and status fields in the database
      await dealService.update(dealId, { 
        stage: newStage,
        status: newStatus,
        updated_at: new Date().toISOString()
      });
      
      console.log('✅ Deal updated successfully in database');
      
      // Update local state
      setDeals(prevDeals =>
        prevDeals.map(deal =>
          deal.id === dealId
            ? {
                ...deal,
                stage: newStage,
                status: newStatus,
                probability: calculateProbability(newStatus),
                days_in_stage: 0,
                next_action: getNextAction(newStatus)
              }
            : deal
        )
      );

      toast({
        title: "Deal Updated",
        description: `Deal moved to ${PIPELINE_STAGES.find(s => s.id === newStage)?.name}`,
      });
    } catch (error: any) {
      console.error('❌ Error updating deal stage:', error);
      toast({
        title: "Error",
        description: "Failed to update deal stage. Please try again.",
        variant: "destructive",
      });
      
      // Reload data to ensure UI is in sync with database
      loadData();
    }
  };

  const handleEditDeal = (deal: any) => {
    setEditingDeal(deal);
    setShowEditDialog(true);
  };

  const handleDeleteDeal = (deal: any) => {
    setDealToDelete(deal);
    setShowDeleteDialog(true);
  };

  const confirmDeleteDeal = async () => {
    if (!dealToDelete) return;

    try {
      console.log('🗑️ Deleting deal with cascade deletion:', dealToDelete.id);
      
      await dealService.delete(dealToDelete.id);
      
      setDeals(prevDeals => prevDeals.filter(deal => deal.id !== dealToDelete.id));
      
      toast({
        title: "Deal Deleted Successfully",
        description: `Deal "${dealToDelete.title}" and all associated payment schedules and commissions have been deleted.`,
      });
      
      setShowDeleteDialog(false);
      setDealToDelete(null);
    } catch (error: any) {
      console.error('❌ Error deleting deal:', error);
      toast({
        title: "Error Deleting Deal",
        description: "Failed to delete deal and associated records. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateDeal = async (updatedDeal: any) => {
    try {
      // Update local state
      setDeals(prevDeals =>
        prevDeals.map(deal =>
          deal.id === updatedDeal.id
            ? {
                ...deal,
                ...updatedDeal,
                stage: mapStatusToStage(updatedDeal.status),
                probability: calculateProbability(updatedDeal.status),
                days_in_stage: 0,
                next_action: getNextAction(updatedDeal.status),
                health_score: calculateHealthScore({ ...deal, ...updatedDeal })
              }
            : deal
        )
      );
      
      toast({
        title: "Deal Updated",
        description: `Deal "${updatedDeal.title}" has been updated successfully`,
      });
      
      setShowEditDialog(false);
      setEditingDeal(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update deal",
        variant: "destructive",
      });
    }
  };

  // Export functionality
  const handleExport = () => {
    try {
      // Prepare data for export
      const exportData = filteredDeals.map(deal => ({
        'Deal Title': deal.title,
        'Client': deal.client_name,
        'Created By': deal.created_by_name || 'Unknown',
        'Assigned To': deal.assigned_to_name || 'Unassigned',
        'Stage': mapStageToStatus(deal.stage),
        'Value': deal.value,
        'Priority': deal.priority,
        'Probability': `${deal.probability}%`,
        'Health Score': `${deal.health_score}%`,
        'Days in Stage': deal.days_in_stage,
        'Expected Close Date': deal.close_date ? new Date(deal.close_date).toLocaleDateString() : 'Not set',
        'Created Date': new Date(deal.created_at).toLocaleDateString(),
        'Last Updated': new Date(deal.updated_at || deal.created_at).toLocaleDateString(),
        'Description': deal.description || '',
        'Notes': deal.notes || '',
        'Next Action': deal.next_action
      }));

      // Convert to CSV
      const headers = Object.keys(exportData[0]);
      const csvContent = [
        headers.join(','),
        ...exportData.map(row =>
          headers.map(header => `"${row[header] || ''}"`).join(',')
        )
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `deals_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `Exported ${exportData.length} deals to CSV`,
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: "Failed to export deals data",
        variant: "destructive",
      });
    }
  };

  // Filter deals based on search and filters
  const filteredDeals = deals.filter(deal => {
    const matchesSearch = deal.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         deal.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         deal.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStage = filterStage === "all" || deal.stage === filterStage;
    const matchesPriority = filterPriority === "all" || deal.priority === filterPriority;
    
    return matchesSearch && matchesStage && matchesPriority;
  });

  const getDealsByStage = (stageId: string) => {
    return filteredDeals.filter(deal => deal.stage === stageId);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-red-600';
      case 'Medium': return 'text-yellow-600';
      case 'Low': return 'text-green-600';
      default: return 'text-blue-600';
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading deals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Pipeline</h1>
          <p className="text-gray-600">Manage deals through the complete SPACE sales process</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="text-xs"
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="text-xs"
            >
              <FileText className="h-4 w-4 mr-1" />
              List
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Deal
          </Button>
        </div>
      </div>

      {/* Enhanced Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search deals, clients, or descriptions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {PIPELINE_STAGES.map(stage => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Board */}
      {viewMode === 'kanban' ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          {/* Pipeline Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{filteredDeals.length}</div>
                <div className="text-sm text-gray-600">Total Deals</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatAmount(filteredDeals.reduce((sum, deal) => sum + (deal.value || 0), 0))}
                </div>
                <div className="text-sm text-gray-600">Pipeline Value</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {filteredDeals.length > 0
                    ? Math.round(filteredDeals.reduce((sum, deal) => sum + (deal.probability || 0), 0) / filteredDeals.length)
                    : 0
                  }%
                </div>
                <div className="text-sm text-gray-600">Avg. Probability</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatAmount(
                    filteredDeals.reduce((sum, deal) => sum + ((deal.value || 0) * (deal.probability || 0) / 100), 0)
                  )}
                </div>
                <div className="text-sm text-gray-600">Weighted Value</div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Kanban Container */}
          <div className="overflow-x-auto">
            {/* Scroll Indicator */}
            <div className="flex space-x-4 pb-6 min-w-max">
              {PIPELINE_STAGES.map(stage => {
                const IconComponent = stage.icon;
                const stageDeals = getDealsByStage(stage.id);
                const totalValue = stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
                
                return (
                  <div key={stage.id} className="flex-shrink-0 w-80">
                    {/* Stage Header Card */}
                    <Card className="mb-4 border-t-4" style={{ borderTopColor: stage.color }}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div 
                              className="p-2 rounded-lg text-white"
                              style={{ backgroundColor: stage.color }}
                            >
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <div>
                              <CardTitle className="text-sm font-semibold">
                                {stage.name}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                {stage.description}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {stageDeals.length}
                          </Badge>
                        </div>
                        
                        {/* Stage Statistics */}
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t">
                          <div className="text-center">
                            <div className="text-xs text-gray-500">Total Value</div>
                            <div className="text-sm font-semibold">
                              {formatAmount(totalValue)}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-500">Avg. Probability</div>
                            <div className="text-sm font-semibold">
                              {stageDeals.length > 0
                                ? Math.round(stageDeals.reduce((sum, deal) => sum + (deal.probability || 0), 0) / stageDeals.length)
                                : 0
                              }%
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>

                    {/* Deals Container */}
                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`min-h-[200px] space-y-3 p-2 rounded-lg transition-colors ${
                            snapshot.isDraggingOver ? 'bg-blue-50 border-2 border-blue-200 border-dashed' : ''
                          }`}
                        >
                          {getDealsByStage(stage.id).map((deal, index) => (
                            <Draggable key={deal.id} draggableId={deal.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => navigate(`/crm/deals/${deal.id}`)}
                                  className={`cursor-pointer hover:shadow-lg transition-shadow card-overflow-safe ${
                                    snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                                  }`}
                                >
                                  <CardContent className="p-4">
                                    {/* Deal Header */}
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-sm text-gray-900 truncate">
                                          {deal.title}
                                        </h4>
                                        <p className="text-xs text-gray-600 mt-1 flex items-center">
                                          <Building2 className="h-3 w-3 mr-1" />
                                          {deal.client_name}
                                        </p>
                                      </div>
                                      <div className="flex items-center space-x-1 ml-2">
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs ${getPriorityColor(deal.priority)}`}
                                        >
                                          {deal.priority}
                                        </Badge>
                                      </div>
                                    </div>

                                    {/* Action Menu */}
                                    <div className="flex items-center justify-between mb-3">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 w-6 p-0"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedDeal(deal);
                                              setShowDealDetails(true);
                                            }}>
                                            <Eye className="mr-2 h-4 w-4" />
                                            View Details
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEditDeal(deal);
                                            }}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteDeal(deal);
                                            }}
                                            className="text-red-600 hover:text-red-700"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>

                                    {/* Deal Value and Status */}
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center space-x-1">
                                        <DollarSign className="h-4 w-4 text-green-600" />
                                        <span className="font-semibold text-green-600">
                                          {formatAmount(deal.value)}
                                        </span>
                                      </div>
                                      <div className={`text-xs font-medium ${getHealthScoreColor(deal.health_score)}`}>
                                        {deal.health_score}% Health
                                      </div>
                                    </div>

                                    {/* Key Metrics Grid */}
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                                      <div className="flex items-center space-x-1">
                                        <Target className="h-3 w-3" />
                                        <span>Prob:</span>
                                        <span className="font-medium">{deal.probability}%</span>
                                      </div>
                                      <div className="flex items-center space-x-1">
                                        <Clock className="h-3 w-3" />
                                        <span>{deal.days_in_stage} days</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center space-x-1 text-xs text-gray-600 mb-3">
                                      <User className="h-3 w-3" />
                                      <span>{deal.created_by_name || deal.created_by || 'Unknown'}</span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mb-3">
                                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                                        <span>Progress</span>
                                        <span>{deal.probability}%</span>
                                      </div>
                                      <Progress value={deal.probability} className="h-2" />
                                    </div>

                                    {/* Next Action */}
                                    <div className="border-t pt-2">
                                      <p className="text-xs text-gray-500">Next Action:</p>
                                      <p className="text-xs font-medium text-gray-700 mt-1">
                                        {deal.next_action}
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          
                          {/* Empty State */}
                          {stageDeals.length === 0 && (
                            <div className="text-center py-8 text-gray-400">
                              <div className="text-4xl mb-2">📋</div>
                              <p className="text-sm">No deals in {stage.name}</p>
                              <p className="text-xs">Drag deals here or create new ones</p>
                            </div>
                          )}
                          
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </div>
        </DragDropContext>
      ) : (
        /* List View */
        <Card>
          <CardHeader>
            <CardTitle>Deals List</CardTitle>
            <CardDescription>All deals in a comprehensive table view</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Probability</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Days in Stage</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{deal.title}</div>
                        <div className="text-sm text-gray-500">{deal.description}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span>{deal.client_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>{deal.created_by_name || deal.created_by || 'Unknown User'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {mapStageToStatus(deal.stage)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">
                        {formatAmount(deal.value)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(deal.priority)}>
                        {deal.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span>{deal.probability}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={getHealthScoreColor(deal.health_score)}>
                        {deal.health_score}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{deal.days_in_stage} days</span>
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
                          <DropdownMenuItem onClick={() => handleEditDeal(deal)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteDeal(deal)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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
      )}

      {/* Deal Details Dialog */}
      <Dialog open={showDealDetails} onOpenChange={setShowDealDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDeal?.title}</DialogTitle>
          </DialogHeader>
          {selectedDeal && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="notes">Notes ({dealNotes.length})</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="commission">Commission</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                {/* Deal Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Deal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Value</Label>
                        <div className="font-semibold text-green-600">
                          {formatAmount(selectedDeal.value)}
                        </div>
                      </div>
                      <div>
                        <Label>Probability</Label>
                        <div className="font-semibold">
                          {selectedDeal.probability}%
                        </div>
                      </div>
                      <div>
                        <Label>Priority</Label>
                        <Badge className={getPriorityColor(selectedDeal.priority)}>
                          {selectedDeal.priority}
                        </Badge>
                      </div>
                      <div>
                        <Label>Health Score</Label>
                        <div className={`font-semibold ${getHealthScoreColor(selectedDeal.health_score)}`}>
                          {selectedDeal.health_score}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Created by</Label>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>{selectedDeal.created_by_name || selectedDeal.created_by || 'Unknown User'}</span>
                        </div>
                      </div>
                      <div>
                        <Label>Created on</Label>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>{new Date(selectedDeal.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Next Action</Label>
                      <div className="font-medium">{selectedDeal.next_action}</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Client Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Client Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{selectedDeal.client_name}</span>
                      </div>
                      {selectedDeal.client_info?.email && (
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span>{selectedDeal.client_info.email}</span>
                        </div>
                      )}
                      {selectedDeal.client_info?.phone && (
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{selectedDeal.client_info.phone}</span>
                        </div>
                      )}
                      {selectedDeal.client_info?.city && (
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>{selectedDeal.client_info.city}</span>
                        </div>
                      )}
                      {selectedDeal.client_info?.country && (
                        <div className="flex items-center space-x-2">
                          <Globe className="h-4 w-4 text-gray-400" />
                          <span>{selectedDeal.client_info.country}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="notes" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Add Note</h3>
                </div>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a note about this deal..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                  />
                  <Button onClick={() => {
                    if (newNote.trim()) {
                      const note: DealNote = {
                        id: Date.now().toString(),
                        content: newNote,
                        author: 'Current User',
                        timestamp: new Date().toISOString(),
                        type: 'note'
                      };
                      setDealNotes([note, ...dealNotes]);
                      setNewNote('');
                    }
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {dealNotes.map((note) => (
                    <Card key={note.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{note.author}</span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(note.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-gray-700">{note.content}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="tasks">
                <p className="text-gray-600">Task management will be displayed here</p>
              </TabsContent>
              
              <TabsContent value="payments" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Schedule</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {paymentSchedule.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium">{payment.description}</div>
                            <div className="text-sm text-gray-600">
                              Due: {new Date(payment.due_date).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatAmount(payment.amount)}</div>
                            <Badge variant="outline">{payment.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="commission" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Commission Structure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {commissions.map((commission) => (
                        <div key={commission.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium">{commission.user_name}</div>
                            <div className="text-sm text-gray-600">
                              {commission.percentage}% commission
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatAmount(commission.amount)}</div>
                            <Badge variant="outline">{commission.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="activity">
                <p className="text-gray-600">Activity timeline will be displayed here</p>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Deal Dialog */}
      {editingDeal && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Deal - {editingDeal.title}</DialogTitle>
              <DialogDescription>
                Update deal information, financial details, and assignment.
              </DialogDescription>
            </DialogHeader>
            <ComprehensiveDealForm
              deal={editingDeal}
              clients={clients}
              exhibitions={expos}
              onSuccess={handleUpdateDeal}
              onCancel={() => setShowEditDialog(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDeleteDeal}
        title="Delete Deal"
        description="This action cannot be undone. This will permanently delete the deal and ALL associated records including payment schedules, commission schedules, and related data."
        itemName={dealToDelete?.title || ''}
        itemDetails={dealToDelete && (
          <div className="space-y-1 text-sm text-gray-600">
            <div>{dealToDelete.client_name}</div>
            <div>{formatAmount(dealToDelete.value)}</div>
            <div>Stage: {dealToDelete.status}</div>
          </div>
        )}
      />

      {/* Create Deal Dialog */}
      <CreateDealDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={loadData}
        clients={clients}
        exhibitions={expos}
      />
    </div>
  );
};

export default Deals;