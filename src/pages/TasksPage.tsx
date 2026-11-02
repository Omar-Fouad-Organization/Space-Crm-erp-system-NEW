import {WorkflowLinks} from '@/components/workspace/WorkflowLinks';
import {useQuickCreate} from '@/hooks/useQuickCreate';
import {all as apiAll,save as apiSave,remove as apiRemove,metadata as apiMetadata} from '@/services/laravelClient';
import {api} from '@/crm/api';
import {toast} from '@/hooks/use-toast';
import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  CheckSquare,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  Building2,
  MessageSquare,
  FileText,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Task, Ticket } from '@/types';
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog';
import CreateTicketDialog from '@/components/tasks/CreateTicketDialog';
import { format } from 'date-fns';

// Mock data




const getPriorityColor = (priority: 'low' | 'medium' | 'high' | 'urgent') => {
  const colors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };
  return colors[priority];
};

const getTaskStatusColor = (status: string) => {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const getTicketStatusColor = (status: string) => {
  const colors = {
    open: 'bg-red-100 text-red-800',
    in_progress: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800'
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const getStatusIcon = (status: string, type: 'task' | 'ticket') => {
  if (type === 'task') {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'in_progress':
        return <AlertTriangle className="h-4 w-4 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  } else {
    switch (status) {
      case 'open':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'closed':
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  }
};

export default function TasksPage({initialTab='tasks'}:{initialTab?:string}) {
  const [editingTask,setEditingTask]=useState<any>(null);
  const [editingTicket,setEditingTicket]=useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  useQuickCreate(()=>setShowCreateTaskDialog(true));
  const [showCreateTicketDialog, setShowCreateTicketDialog] = useState(false);

  React.useEffect(()=>{Promise.all([apiAll('tasks'),apiAll('tickets')]).then(([tasks,tickets])=>{setTasks(tasks);setTickets(tickets);}).catch(error=>toast({title:'Unable to load tasks',description:error.message,variant:'destructive'}));},[]);
  const changeStatus=async(resource:string,row:any,status:string)=>{try{const updated=await apiSave(resource,{status},row.id);(resource==='tasks'?setTasks:setTickets)(prev=>prev.map(r=>r.id===row.id?updated:r));}catch(error){toast({title:'Update failed',description:(error as Error).message,variant:'destructive'});}};
  const deleteRecord=async(resource:string,row:any)=>{try{await apiRemove(resource,row.id);(resource==='tasks'?setTasks:setTickets)(prev=>prev.filter(r=>r.id!==row.id));}catch(error){toast({title:'Delete failed',description:(error as Error).message,variant:'destructive'});}};
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ticket.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleCreateTask = async(taskData:any)=>{try{const row=await apiSave('tasks',{...taskData,status:editingTask?.status||'pending'},editingTask?.id);setTasks(prev=>editingTask?prev.map(t=>t.id===row.id?row:t):[...prev,row]);setEditingTask(null);setShowCreateTaskDialog(false);return true;}catch(error){toast({title:'Task not saved',description:(error as Error).message,variant:'destructive'});return false;}};

  const handleCreateTicket = async(ticketData:any)=>{try{const row=await apiSave('tickets',{...ticketData,status:editingTicket?.status||'open'},editingTicket?.id);setTickets(prev=>editingTicket?prev.map(t=>t.id===row.id?row:t):[...prev,row]);setEditingTicket(null);setShowCreateTicketDialog(false);return true;}catch(error){toast({title:'Ticket not saved',description:(error as Error).message,variant:'destructive'});return false;}};

  // Calculate stats
  const taskStats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => new Date(t.due_date) < new Date() && t.status !== 'completed').length
  };

  const ticketStats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    overdue_sla: tickets.filter(t => new Date(t.sla_due_date) < new Date() && t.status !== 'resolved' && t.status !== 'closed').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-crm-primary-text">Tasks & Tickets</h1><WorkflowLinks sections={["reminders"]}/>
          <p className="text-crm-secondary-text">Manage internal tasks and client support tickets</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button onClick={() => {setEditingTask(null);setShowCreateTaskDialog(true);}} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
          <Button onClick={() => {setEditingTicket(null);setShowCreateTicketDialog(true);}} className="crm-button-primary">
            <Plus className="h-4 w-4 mr-2" />
            Create Ticket
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Active Tasks</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">
              {taskStats.pending + taskStats.in_progress}
            </p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Overdue Tasks</p>
            <p className="text-2xl font-semibold text-red-600 font-tabular">{taskStats.overdue}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Open Tickets</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">
              {ticketStats.open + ticketStats.in_progress}
            </p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">SLA Breaches</p>
            <p className="text-2xl font-semibold text-red-600 font-tabular">{ticketStats.overdue_sla}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="tasks">
            Tasks ({taskStats.total})
          </TabsTrigger>
          <TabsTrigger value="tickets">
            Tickets ({ticketStats.total})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-6">
          {/* Filters */}
          <Card className="crm-card">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-crm-secondary-text" />
                    <Input
                      placeholder="Search tasks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tasks Table */}
          <Card className="crm-card">
            <CardHeader>
              <CardTitle>All Tasks</CardTitle>
              <CardDescription>
                {filteredTasks.length} tasks found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Related</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-crm-primary-text">{task.title}</p>
                          {task.description && (
                            <p className="text-sm text-crm-secondary-text mt-1">{task.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-crm-secondary-text" />
                          <span>{task.assigned_user?.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.deal && (
                          <div className="flex items-center space-x-1">
                            <FileText className="h-4 w-4 text-crm-secondary-text" />
                            <span className="text-sm">{task.deal.name}</span>
                          </div>
                        )}
                        {task.client && (
                          <div className="flex items-center space-x-1">
                            <Building2 className="h-4 w-4 text-crm-secondary-text" />
                            <span className="text-sm">{task.client.company_name}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4 text-crm-secondary-text" />
                          <span className="text-sm">
                            {format(new Date(task.due_date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(task.status, 'task')}
                          <Badge className={getTaskStatusColor(task.status)}>
                            {task.status.replace('_', ' ')}
                          </Badge>
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
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={()=>{setEditingTask(task);setShowCreateTaskDialog(true);}}><Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={()=>{setEditingTask(task);setShowCreateTaskDialog(true);}}><Edit className="mr-2 h-4 w-4" />
                              Edit Task
                            </DropdownMenuItem>
                            {task.status !== 'completed' && (
                              <DropdownMenuItem onClick={()=>{changeStatus('tasks',task,'completed')}}><CheckCircle className="mr-2 h-4 w-4" />
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={()=>{deleteRecord('tasks',task)}}><Trash2 className="mr-2 h-4 w-4" />
                              Delete Task
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
        </TabsContent>

        <TabsContent value="tickets" className="space-y-6">
          {/* Filters */}
          <Card className="crm-card">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-crm-secondary-text" />
                    <Input
                      placeholder="Search tickets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priority</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tickets Table */}
          <Card className="crm-card">
            <CardHeader>
              <CardTitle>Support Tickets</CardTitle>
              <CardDescription>
                {filteredTickets.length} tickets found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>SLA Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-crm-primary-text">{ticket.title}</p>
                          <p className="text-sm text-crm-secondary-text mt-1">{ticket.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-crm-secondary-text" />
                          <div>
                            <p className="font-medium">{ticket.client?.company_name}</p>
                            {ticket.deal && (
                              <p className="text-xs text-crm-secondary-text">{ticket.deal.name}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {ticket.issue_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ticket.assigned_user ? (
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-crm-secondary-text" />
                            <span>{ticket.assigned_user.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-crm-secondary-text">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4 text-crm-secondary-text" />
                          <span className="text-sm">
                            {ticket.sla_due_date && !isNaN(new Date(ticket.sla_due_date).getTime()) ? format(new Date(ticket.sla_due_date), 'MMM dd, HH:mm') : 'Not set'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(ticket.status, 'ticket')}
                          <Badge className={getTicketStatusColor(ticket.status)}>
                            {ticket.status.replace('_', ' ')}
                          </Badge>
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
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={()=>{setEditingTicket(ticket);setShowCreateTicketDialog(true);}}><Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={()=>{setEditingTicket(ticket);setShowCreateTicketDialog(true);}}><Edit className="mr-2 h-4 w-4" />
                              Edit Ticket
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={()=>{setEditingTicket(ticket);setShowCreateTicketDialog(true);}}><MessageSquare className="mr-2 h-4 w-4" />
                              Add Comment
                            </DropdownMenuItem>
                            {ticket.status !== 'resolved' && (
                              <DropdownMenuItem onClick={()=>{changeStatus('tickets',ticket,'resolved')}}><CheckCircle className="mr-2 h-4 w-4" />
                                Mark Resolved
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={()=>{deleteRecord('tickets',ticket)}}><Trash2 className="mr-2 h-4 w-4" />
                              Delete Ticket
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
        </TabsContent>
      </Tabs>

      {/* Create Dialogs */}
      <CreateTaskDialog
        key={editingTask?.id||'new-task'}
        initialData={editingTask}
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        onSubmit={handleCreateTask}
      />

      <CreateTicketDialog
        key={editingTicket?.id||'new-ticket'}
        initialData={editingTicket}
        open={showCreateTicketDialog}
        onOpenChange={setShowCreateTicketDialog}
        onSubmit={handleCreateTicket}
      />
    </div>
  );
}
