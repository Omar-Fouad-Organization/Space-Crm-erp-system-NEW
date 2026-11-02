import {MeetingCalendar} from '@/components/workspace/MeetingCalendar';
import {exportCsv} from '@/crm/api';
import {all as apiAll,save as apiSave,remove as apiRemove,metadata as apiMetadata} from '@/services/laravelClient';
import {api} from '@/crm/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Clock,
  Users,
  MapPin,
  Video,
  CheckCircle,
  AlertTriangle,
  Eye,
  Edit,
  Trash2,
  Phone,
  Mail,
  FileText,
  CalendarDays,
  Timer,
  UserCheck,
  Building2,
  Zap,
  Bell,
  Send,
  Copy,
  ExternalLink,
  Download,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Share2,
  MessageSquare,
  Paperclip,
  Star,
  Flag,
  Archive,
  RotateCcw,
  Settings,
  Link,
  Globe,
  Loader2
} from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  type: 'Client Meeting' | 'Planning Meeting' | 'Internal Meeting' | 'Presentation' | 'Follow-up' | 'Demo' | 'Training';
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled' | 'Rescheduled';
  date: string;
  time: string;
  duration: number;
  location: string;
  meetingType: 'In-Person' | 'Virtual' | 'Phone' | 'Hybrid';
  organizer: string;
  attendees: string[];
  client?: string;
  deal?: string;
  agenda: string;
  notes: string;
  priority: 'High' | 'Medium' | 'Low';
  meetingUrl?: string;
  recordingUrl?: string;
  attachments?: string[];
  reminders?: string[];
  recurring?: boolean;
  recurringPattern?: string;
  created_at: string;
  updated_at: string;
}

interface MeetingForm {
  title: string;
  type: string;
  date: string;
  time: string;
  duration: string;
  location: string;
  meetingType: string;
  attendees: string;
  client: string;
  deal: string;
  agenda: string;
  notes: string;
  priority: string;
  meetingUrl: string;
  recurring: boolean;
  recurringPattern: string;
}

const Meetings = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all-status");
  const [typeFilter, setTypeFilter] = useState("all-types");
  const [dateFilter, setDateFilter] = useState("all-dates");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null);
  const [meetingForm, setMeetingForm] = useState<MeetingForm>({
    title: '',
    type: 'Client Meeting',
    date: '',
    time: '',
    duration: '60',
    location: '',
    meetingType: 'Virtual',
    attendees: '',
    client: '',
    deal: '',
    agenda: '',
    notes: '',
    priority: 'Medium',
    meetingUrl: '',
    recurring: false,
    recurringPattern: 'weekly'
  });

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {setLoading(true);try{setMeetings(await apiAll('meetings') as any);}catch(error){toast({title:'Unable to load records',description:(error as Error).message,variant:'destructive'});}finally{setLoading(false);}};

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let newMeeting: Meeting = {
        id: `meeting-${Date.now()}`,
        title: meetingForm.title,
        type: meetingForm.type as Meeting['type'],
        status: 'Scheduled',
        date: meetingForm.date,
        time: meetingForm.time,
        duration: parseInt(meetingForm.duration),
        location: meetingForm.location,
        meetingType: meetingForm.meetingType as Meeting['meetingType'],
        organizer: "Current User", // In real app, get from auth context
        attendees: meetingForm.attendees.split(',').map(a => a.trim()).filter(a => a),
        client: meetingForm.client,
        deal: meetingForm.deal,
        agenda: meetingForm.agenda,
        notes: meetingForm.notes,
        priority: meetingForm.priority as Meeting['priority'],
        meetingUrl: meetingForm.meetingUrl,
        recurring: meetingForm.recurring,
        recurringPattern: meetingForm.recurringPattern,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      newMeeting=await apiSave('meetings',{...newMeeting,organizer_id:(await apiMetadata()).user.id,meeting_type:meetingForm.type}) as any;
      setMeetings(prev => [newMeeting, ...prev]);

      toast({
        title: "Meeting Created",
        description: `${meetingForm.title} has been scheduled successfully`,
      });

      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleEditMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeeting) return;

    try {
      let updatedMeeting: Meeting = {
        ...selectedMeeting,
        title: meetingForm.title,
        type: meetingForm.type as Meeting['type'],
        date: meetingForm.date,
        time: meetingForm.time,
        duration: parseInt(meetingForm.duration),
        location: meetingForm.location,
        meetingType: meetingForm.meetingType as Meeting['meetingType'],
        attendees: meetingForm.attendees.split(',').map(a => a.trim()).filter(a => a),
        client: meetingForm.client,
        deal: meetingForm.deal,
        agenda: meetingForm.agenda,
        notes: meetingForm.notes,
        priority: meetingForm.priority as Meeting['priority'],
        meetingUrl: meetingForm.meetingUrl,
        recurring: meetingForm.recurring,
        recurringPattern: meetingForm.recurringPattern,
        updated_at: new Date().toISOString()
      };

      updatedMeeting=await apiSave('meetings',{...updatedMeeting,meeting_type:meetingForm.type},selectedMeeting.id) as any;
      setMeetings(prev => prev.map(m => m.id === selectedMeeting.id ? updatedMeeting : m));

      toast({
        title: "Meeting Updated",
        description: `${meetingForm.title} has been updated successfully`,
      });

      setShowEditDialog(false);
      setSelectedMeeting(null);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteMeeting = async () => {
    if (!meetingToDelete) return;

    try {
      await apiRemove('meetings',meetingToDelete.id);
      setMeetings(prev => prev.filter(m => m.id !== meetingToDelete.id));

      toast({
        title: "Meeting Deleted",
        description: `${meetingToDelete.title} has been cancelled and removed`,
      });

      setShowDeleteDialog(false);
      setMeetingToDelete(null);
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleStartMeeting = async (meetingId:string)=>{try{const record=await apiSave('meetings',{status:'In Progress'},meetingId);setMeetings(prev=>prev.map(m=>m.id===meetingId?record as any:m));}catch(error){toast({title:'Update failed',description:(error as Error).message,variant:'destructive'});}};

  const handleJoinMeeting = (meetingId: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (meeting?.meetingUrl) {
      window.open(meeting.meetingUrl, '_blank');
      toast({
        title: "Joining Meeting",
        description: `Opening ${meeting.title} in new tab`,
      });
    } else {
      toast({
        title: "No Meeting URL",
        description: "Meeting URL not available",
        variant: "destructive",
      });
    }
  };

  const handleCompleteMeeting = async (meetingId:string)=>{try{const record=await apiSave('meetings',{status:'Completed'},meetingId);setMeetings(prev=>prev.map(m=>m.id===meetingId?record as any:m));}catch(error){toast({title:'Update failed',description:(error as Error).message,variant:'destructive'});}};

  const handleSendReminder = (id?:string)=>{window.location.hash='/workspace?section=reminders&resource=meetings'+(id?'&record='+id:'');};

  const resetForm = () => {
    setMeetingForm({
      title: '',
      type: 'Client Meeting',
      date: '',
      time: '',
      duration: '60',
      location: '',
      meetingType: 'Virtual',
      attendees: '',
      client: '',
      deal: '',
      agenda: '',
      notes: '',
      priority: 'Medium',
      meetingUrl: '',
      recurring: false,
      recurringPattern: 'weekly'
    });
  };

  // Filter meetings based on search and filters
  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch = searchTerm === "" ||
      meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (meeting.client && meeting.client.toLowerCase().includes(searchTerm.toLowerCase())) ||
      meeting.organizer.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all-status" || meeting.status === statusFilter;
    const matchesType = typeFilter === "all-types" || meeting.type === typeFilter;

    // Date filter logic
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let matchesDate = true;
    if (dateFilter === "today") {
      matchesDate = meeting.date === today;
    } else if (dateFilter === "tomorrow") {
      matchesDate = meeting.date === tomorrow;
    } else if (dateFilter === "this-week") {
      matchesDate = meeting.date >= today && meeting.date <= weekFromNow;
    } else if (dateFilter === "next-week") {
      const nextWeekStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const nextWeekEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      matchesDate = meeting.date >= nextWeekStart && meeting.date <= nextWeekEnd;
    }

    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });

  // Calculate meeting statistics
  const meetingStats = {
    total: meetings.length,
    scheduled: meetings.filter(m => m.status === "Scheduled").length,
    completed: meetings.filter(m => m.status === "Completed").length,
    inProgress: meetings.filter(m => m.status === "In Progress").length,
    overdue: meetings.filter(m => m.status === "Overdue").length,
    totalDuration: meetings.reduce((sum, m) => sum + m.duration, 0),
    averageDuration: meetings.length > 0 ? Math.round(meetings.reduce((sum, m) => sum + m.duration, 0) / meetings.length) : 0,
    thisWeek: meetings.filter(m => {
      const today = new Date();
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const meetingDate = new Date(m.date);
      return meetingDate >= today && meetingDate <= weekFromNow;
    }).length
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Scheduled":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "In Progress":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "Overdue":
        return "bg-red-100 text-red-800 border-red-200";
      case "Cancelled":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "Rescheduled":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Scheduled":
        return <Clock className="h-3 w-3 mr-1" />;
      case "In Progress":
        return <PlayCircle className="h-3 w-3 mr-1" />;
      case "Completed":
        return <CheckCircle className="h-3 w-3 mr-1" />;
      case "Overdue":
        return <AlertTriangle className="h-3 w-3 mr-1" />;
      case "Cancelled":
        return <StopCircle className="h-3 w-3 mr-1" />;
      case "Rescheduled":
        return <RotateCcw className="h-3 w-3 mr-1" />;
      default:
        return <Clock className="h-3 w-3 mr-1" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Client Meeting":
        return <Building2 className="h-4 w-4" />;
      case "Planning Meeting":
        return <CalendarDays className="h-4 w-4" />;
      case "Internal Meeting":
        return <Users className="h-4 w-4" />;
      case "Presentation":
        return <FileText className="h-4 w-4" />;
      case "Follow-up":
        return <Phone className="h-4 w-4" />;
      case "Demo":
        return <PlayCircle className="h-4 w-4" />;
      case "Training":
        return <UserCheck className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getMeetingTypeIcon = (meetingType: string) => {
    switch (meetingType) {
      case "Virtual":
        return <Video className="h-4 w-4" />;
      case "Phone":
        return <Phone className="h-4 w-4" />;
      case "In-Person":
        return <MapPin className="h-4 w-4" />;
      case "Hybrid":
        return <Globe className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "bg-red-100 text-red-800 border-red-200";
      case "Medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 animate-pulse rounded w-64" />
          <div className="h-8 bg-gray-200 animate-pulse rounded w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 animate-pulse rounded" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <Calendar className="inline-block h-8 w-8 mr-3 text-blue-600" />
            Meeting Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Schedule, track, and manage all client and internal meetings
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm" onClick={()=>exportCsv('meetings',meetings,['title','date','time','organizer','client','deal','status'])}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Meeting Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Meetings
                </p>
                <p className="text-2xl font-bold">
                  {meetingStats.total}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All meetings
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Scheduled
                </p>
                <p className="text-2xl font-bold">
                  {meetingStats.scheduled}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Upcoming
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  In Progress
                </p>
                <p className="text-2xl font-bold">
                  {meetingStats.inProgress}
                </p>
              </div>
              <PlayCircle className="h-8 w-8 text-yellow-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active now
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Completed
                </p>
                <p className="text-2xl font-bold">
                  {meetingStats.completed}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Finished
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Overdue
                </p>
                <p className="text-2xl font-bold">
                  {meetingStats.overdue}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Need attention
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Hours
                </p>
                <p className="text-2xl font-bold">
                  {Math.round(meetingStats.totalDuration / 60)}
                </p>
              </div>
              <Timer className="h-8 w-8 text-purple-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Meeting time
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Avg Duration
                </p>
                <p className="text-2xl font-bold">
                  {meetingStats.averageDuration}
                </p>
              </div>
              <Clock className="h-8 w-8 text-indigo-600" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Minutes
            </p>
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
                  placeholder="Search meetings..."
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
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-types">All Types</SelectItem>
                  <SelectItem value="Client Meeting">Client Meeting</SelectItem>
                  <SelectItem value="Planning Meeting">Planning Meeting</SelectItem>
                  <SelectItem value="Internal Meeting">Internal Meeting</SelectItem>
                  <SelectItem value="Presentation">Presentation</SelectItem>
                  <SelectItem value="Follow-up">Follow-up</SelectItem>
                  <SelectItem value="Demo">Demo</SelectItem>
                  <SelectItem value="Training">Training</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-dates">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="next-week">Next Week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meeting Content */}
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Meeting List</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="today">Today's Agenda</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="space-y-4">
          {filteredMeetings.map((meeting) => (
            <Card key={meeting.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="flex-shrink-0 pt-1">
                        {getTypeIcon(meeting.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-semibold truncate">
                            {meeting.title}
                          </h3>
                          {getStatusIcon(meeting.status)}
                          <Badge className={getStatusColor(meeting.status)}>
                            {meeting.status}
                          </Badge>
                          <Badge className={getPriorityColor(meeting.priority)}>
                            {meeting.priority}
                          </Badge>
                          {meeting.recurring && (
                            <Badge variant="outline" className="text-xs">
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Recurring
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          {getMeetingTypeIcon(meeting.meetingType)}
                          <div>
                            <div className="font-medium">{meeting.meetingType}</div>
                            <div className="text-muted-foreground">{meeting.type}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{formatDate(meeting.date)}</div>
                            <div className="text-muted-foreground">{formatTime(meeting.time)} ({meeting.duration} min)</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <UserCheck className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{meeting.organizer}</div>
                            <div className="text-muted-foreground">Organizer</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{meeting.client || "Internal"}</div>
                            <div className="text-muted-foreground">{meeting.deal || "No deal linked"}</div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{meeting.location}</span>
                          {meeting.meetingUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(meeting.meetingUrl, '_blank')}
                              className="h-6 px-2"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Join
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {meeting.attendees.length} attendees: {meeting.attendees.slice(0, 2).join(", ")}
                            {meeting.attendees.length > 2 && <span className="text-muted-foreground"> +{meeting.attendees.length - 2} more</span>}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div>
                          <span className="font-medium text-sm">Agenda:</span>
                          <p className="text-sm text-muted-foreground mt-1">{meeting.agenda}</p>
                        </div>
                        {meeting.notes && (
                          <div>
                            <span className="font-medium text-sm">Notes:</span>
                            <p className="text-sm text-muted-foreground mt-1">{meeting.notes}</p>
                          </div>
                        )}
                        {meeting.attachments && meeting.attachments.length > 0 && (
                          <div className="flex items-center space-x-2">
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{meeting.attachments.length} attachments</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {meeting.status === "Scheduled" && (
                        <Button
                          size="sm"
                          onClick={() => handleStartMeeting(meeting.id)}
                        >
                          <PlayCircle className="h-4 w-4 mr-1" />
                          Start Meeting
                        </Button>
                      )}
                      {meeting.status === "In Progress" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleJoinMeeting(meeting.id)}
                          >
                            <Video className="h-4 w-4 mr-1" />
                            Join Meeting
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCompleteMeeting(meeting.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        </>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => {
                            setSelectedMeeting(meeting);
                            setShowDetailsDialog(true);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedMeeting(meeting);
                            setMeetingForm({
                              title: meeting.title,
                              type: meeting.type,
                              date: meeting.date,
                              time: meeting.time,
                              duration: meeting.duration.toString(),
                              location: meeting.location,
                              meetingType: meeting.meetingType,
                              attendees: meeting.attendees.join(', '),
                              client: meeting.client || '',
                              deal: meeting.deal || '',
                              agenda: meeting.agenda,
                              notes: meeting.notes,
                              priority: meeting.priority,
                              meetingUrl: meeting.meetingUrl || '',
                              recurring: meeting.recurring || false,
                              recurringPattern: meeting.recurringPattern || 'weekly'
                            });
                            setShowEditDialog(true);
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Meeting
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleSendReminder(meeting.id)}>
                            <Bell className="h-4 w-4 mr-2" />
                            Send Reminder
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Meeting Link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setMeetingToDelete(meeting);
                              setShowDeleteDialog(true);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Cancel Meeting
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredMeetings.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-lg font-medium">No meetings found</h3>
                <p className="mt-1 text-muted-foreground">
                  {searchTerm || statusFilter !== "all-status" || typeFilter !== "all-types" || dateFilter !== "all-dates"
                    ? "Try adjusting your search criteria"
                    : "Get started by scheduling your first meeting"
                  }
                </p>
                <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Meeting
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Meeting Calendar</CardTitle>
              <CardDescription>Browse saved meetings by month and open their details.</CardDescription>
            </CardHeader>
            <CardContent>
              <MeetingCalendar meetings={meetings} onOpen={meeting=>{setSelectedMeeting(meeting);setShowDetailsDialog(true);}}/>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="today" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Meeting Agenda</CardTitle>
              <CardDescription>Overview of today's scheduled meetings and activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredMeetings
                  .filter(meeting => {
                    const today = new Date().toISOString().split('T')[0];
                    return meeting.date === today || meeting.status === "In Progress";
                  })
                  .map((meeting) => (
                    <div key={meeting.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {getTypeIcon(meeting.type)}
                        </div>
                        <div>
                          <h4 className="font-medium">{meeting.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {meeting.time} • {meeting.duration} min • {meeting.location}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(meeting.status)}>
                          {meeting.status}
                        </Badge>
                        {meeting.status === "Scheduled" && (
                          <Button
                            size="sm"
                            onClick={() => handleStartMeeting(meeting.id)}
                          >
                            Start
                          </Button>
                        )}
                        {meeting.status === "In Progress" && (
                          <Button
                            size="sm"
                            onClick={() => handleJoinMeeting(meeting.id)}
                          >
                            Join
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                {filteredMeetings.filter(meeting => {
                  const today = new Date().toISOString().split('T')[0];
                  return meeting.date === today || meeting.status === "In Progress";
                }).length === 0 && (
                  <div className="text-center py-8">
                    <Calendar className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">No meetings scheduled for today</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Meeting Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <Plus className="inline-block h-5 w-5 mr-2" />
              Schedule New Meeting
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateMeeting} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="title">Meeting Title *</Label>
                  <Input
                    id="title"
                    value={meetingForm.title}
                    onChange={(e) => setMeetingForm({...meetingForm, title: e.target.value})}
                    placeholder="Enter meeting title"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Meeting Type</Label>
                  <Select value={meetingForm.type} onValueChange={(value) => setMeetingForm({...meetingForm, type: value})}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Client Meeting">Client Meeting</SelectItem>
                      <SelectItem value="Planning Meeting">Planning Meeting</SelectItem>
                      <SelectItem value="Internal Meeting">Internal Meeting</SelectItem>
                      <SelectItem value="Presentation">Presentation</SelectItem>
                      <SelectItem value="Follow-up">Follow-up</SelectItem>
                      <SelectItem value="Demo">Demo</SelectItem>
                      <SelectItem value="Training">Training</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={meetingForm.priority} onValueChange={(value) => setMeetingForm({...meetingForm, priority: value})}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Date & Time */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Date & Time</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={meetingForm.date}
                    onChange={(e) => setMeetingForm({...meetingForm, date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="time">Time *</Label>
                  <Input
                    id="time"
                    type="time"
                    value={meetingForm.time}
                    onChange={(e) => setMeetingForm({...meetingForm, time: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={meetingForm.duration}
                    onChange={(e) => setMeetingForm({...meetingForm, duration: e.target.value})}
                    placeholder="60"
                  />
                </div>
              </div>
            </div>

            {/* Location & Format */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Location & Format</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="meetingType">Meeting Format</Label>
                  <Select value={meetingForm.meetingType} onValueChange={(value) => setMeetingForm({...meetingForm, meetingType: value})}>
                    <SelectTrigger id="meetingType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Virtual">Virtual</SelectItem>
                      <SelectItem value="In-Person">In-Person</SelectItem>
                      <SelectItem value="Phone">Phone</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location">Location/URL</Label>
                  <Input
                    id="location"
                    value={meetingForm.location}
                    onChange={(e) => setMeetingForm({...meetingForm, location: e.target.value})}
                    placeholder="Conference room or meeting URL"
                  />
                </div>
              </div>
              {meetingForm.meetingType === 'Virtual' && (
                <div>
                  <Label htmlFor="meetingUrl">Meeting URL</Label>
                  <Input
                    id="meetingUrl"
                    value={meetingForm.meetingUrl}
                    onChange={(e) => setMeetingForm({...meetingForm, meetingUrl: e.target.value})}
                    placeholder="https://zoom.us/j/123456789"
                  />
                </div>
              )}
            </div>

            {/* Participants & Context */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Participants & Context</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="attendees">Attendees</Label>
                  <Input
                    id="attendees"
                    value={meetingForm.attendees}
                    onChange={(e) => setMeetingForm({...meetingForm, attendees: e.target.value})}
                    placeholder="Enter attendee names, separated by commas"
                  />
                </div>
                <div>
                  <Label htmlFor="client">Client (Optional)</Label>
                  <Input
                    id="client"
                    value={meetingForm.client}
                    onChange={(e) => setMeetingForm({...meetingForm, client: e.target.value})}
                    placeholder="Client name"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="deal">Related Deal (Optional)</Label>
                <Input
                  id="deal"
                  value={meetingForm.deal}
                  onChange={(e) => setMeetingForm({...meetingForm, deal: e.target.value})}
                  placeholder="Deal or project name"
                />
              </div>
            </div>

            {/* Agenda & Notes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Agenda & Notes</h3>
              <div>
                <Label htmlFor="agenda">Agenda</Label>
                <Textarea
                  id="agenda"
                  value={meetingForm.agenda}
                  onChange={(e) => setMeetingForm({...meetingForm, agenda: e.target.value})}
                  placeholder="Meeting agenda and objectives"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={meetingForm.notes}
                  onChange={(e) => setMeetingForm({...meetingForm, notes: e.target.value})}
                  placeholder="Additional notes or preparation items"
                  rows={2}
                />
              </div>
            </div>

            {/* Recurring Options */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Recurring Options</h3>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={meetingForm.recurring}
                  onChange={(e) => setMeetingForm({...meetingForm, recurring: e.target.checked})}
                  className="rounded"
                />
                <Label htmlFor="recurring">Make this a recurring meeting</Label>
              </div>
              {meetingForm.recurring && (
                <div>
                  <Label htmlFor="recurringPattern">Recurring Pattern</Label>
                  <Select value={meetingForm.recurringPattern} onValueChange={(value) => setMeetingForm({...meetingForm, recurringPattern: value})}>
                    <SelectTrigger id="recurringPattern">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Schedule Meeting
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Meeting Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <Edit className="inline-block h-5 w-5 mr-2" />
              Edit Meeting
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditMeeting} className="space-y-6">
            {/* Same form structure as create dialog */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-title">Meeting Title *</Label>
                  <Input
                    id="edit-title"
                    value={meetingForm.title}
                    onChange={(e) => setMeetingForm({...meetingForm, title: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-type">Meeting Type</Label>
                  <Select value={meetingForm.type} onValueChange={(value) => setMeetingForm({...meetingForm, type: value})}>
                    <SelectTrigger id="edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Client Meeting">Client Meeting</SelectItem>
                      <SelectItem value="Planning Meeting">Planning Meeting</SelectItem>
                      <SelectItem value="Internal Meeting">Internal Meeting</SelectItem>
                      <SelectItem value="Presentation">Presentation</SelectItem>
                      <SelectItem value="Follow-up">Follow-up</SelectItem>
                      <SelectItem value="Demo">Demo</SelectItem>
                      <SelectItem value="Training">Training</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-priority">Priority</Label>
                  <Select value={meetingForm.priority} onValueChange={(value) => setMeetingForm({...meetingForm, priority: value})}>
                    <SelectTrigger id="edit-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Date & Time</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-date">Date *</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={meetingForm.date}
                    onChange={(e) => setMeetingForm({...meetingForm, date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-time">Time *</Label>
                  <Input
                    id="edit-time"
                    type="time"
                    value={meetingForm.time}
                    onChange={(e) => setMeetingForm({...meetingForm, time: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-duration">Duration (minutes)</Label>
                  <Input
                    id="edit-duration"
                    type="number"
                    value={meetingForm.duration}
                    onChange={(e) => setMeetingForm({...meetingForm, duration: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Location & Format</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-meetingType">Meeting Format</Label>
                  <Select value={meetingForm.meetingType} onValueChange={(value) => setMeetingForm({...meetingForm, meetingType: value})}>
                    <SelectTrigger id="edit-meetingType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Virtual">Virtual</SelectItem>
                      <SelectItem value="In-Person">In-Person</SelectItem>
                      <SelectItem value="Phone">Phone</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-location">Location/URL</Label>
                  <Input
                    id="edit-location"
                    value={meetingForm.location}
                    onChange={(e) => setMeetingForm({...meetingForm, location: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Agenda & Notes</h3>
              <div>
                <Label htmlFor="edit-agenda">Agenda</Label>
                <Textarea
                  id="edit-agenda"
                  value={meetingForm.agenda}
                  onChange={(e) => setMeetingForm({...meetingForm, agenda: e.target.value})}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={meetingForm.notes}
                  onChange={(e) => setMeetingForm({...meetingForm, notes: e.target.value})}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Update Meeting
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Meeting Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <Calendar className="inline-block h-5 w-5 mr-2" />
              Meeting Details
            </DialogTitle>
          </DialogHeader>
          {selectedMeeting && (
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedMeeting.title}</h2>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge className={getStatusColor(selectedMeeting.status)}>
                      {selectedMeeting.status}
                    </Badge>
                    <Badge className={getPriorityColor(selectedMeeting.priority)}>
                      {selectedMeeting.priority}
                    </Badge>
                    <span className="text-muted-foreground">{selectedMeeting.type}</span>
                  </div>
                </div>
                <div>
                  {selectedMeeting.meetingUrl && (
                    <Button onClick={() => window.open(selectedMeeting.meetingUrl, '_blank')}>
                      <Video className="h-4 w-4 mr-2" />
                      Join Meeting
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Meeting Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDate(selectedMeeting.date)} at {selectedMeeting.time}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedMeeting.duration} minutes</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getMeetingTypeIcon(selectedMeeting.meetingType)}
                      <span>{selectedMeeting.meetingType}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedMeeting.location}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedMeeting.organizer}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Attendees</h3>
                  <div className="space-y-1">
                    {selectedMeeting.attendees.map((attendee, index) => (
                      <div key={index} className="text-sm">
                        • {attendee}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {selectedMeeting.client && (
                  <div>
                    <h3 className="font-semibold mb-2">Client & Deal</h3>
                    <div className="text-sm space-y-1">
                      <div>Client: {selectedMeeting.client}</div>
                      {selectedMeeting.deal && <div>Deal: {selectedMeeting.deal}</div>}
                    </div>
                  </div>
                )}
                {selectedMeeting.attachments && selectedMeeting.attachments.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Attachments</h3>
                    <div className="space-y-1">
                      {selectedMeeting.attachments.map((attachment, index) => (
                        <div key={index} className="flex items-center space-x-2 text-sm">
                          <Paperclip className="h-3 w-3" />
                          <span>{attachment}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedMeeting.recurring && (
                  <div>
                    <h3 className="font-semibold mb-2">Recurring</h3>
                    <div className="flex items-center space-x-2 text-sm">
                      <RotateCcw className="h-3 w-3" />
                      <span>Repeats {selectedMeeting.recurringPattern}</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Agenda</h3>
                <p className="text-sm text-muted-foreground">{selectedMeeting.agenda}</p>
              </div>

              {selectedMeeting.notes && (
                <div>
                  <h3 className="font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground">{selectedMeeting.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trash2 className="inline-block h-5 w-5 mr-2" />
              Cancel Meeting
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel "{meetingToDelete?.title}"?
              This action will notify all attendees and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Meeting</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMeeting}>
              Cancel Meeting
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Meetings;