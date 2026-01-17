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
const mockTasks: (Task & { assigned_user?: { full_name: string }; deal?: { name: string }; client?: { company_name: string } })[] = [
  {
    id: '1',
    title: 'Follow up with TechCorp on contract terms',
    description: 'Discuss final terms and conditions with client',
    assigned_user_id: '1',
    created_by_id: '1',
    deal_id: '1',
    due_date: '2024-01-20',
    priority: 'high',
    status: 'in_progress',
    created_at: '2024-01-17T09:00:00Z',
    updated_at: '2024-01-17T09:00:00Z',
    assigned_user: { full_name: 'Sarah Johnson' },
    deal: { name: 'Tech Expo 2024 - Premium Booth A1' }
  },
  {
    id: '2',
    title: 'Prepare booth layout proposal',
    assigned_user_id: '2',
    created_by_id: '1',
    deal_id: '1',
    due_date: '2024-01-22',
    priority: 'medium',
    status: 'pending',
    created_at: '2024-01-17T10:00:00Z',
    updated_at: '2024-01-17T10:00:00Z',
    assigned_user: { full_name: 'Mike Rodriguez' },
    deal: { name: 'Tech Expo 2024 - Premium Booth A1' }
  },
  {
    id: '3',
    title: 'Send welcome package to new client',
    assigned_user_id: '1',
    created_by_id: '2',
    client_id: '2',
    due_date: '2024-01-18',
    priority: 'low',
    status: 'completed',
    created_at: '2024-01-16T14:00:00Z',
    updated_at: '2024-01-17T16:00:00Z',
    assigned_user: { full_name: 'Sarah Johnson' },
    client: { company_name: 'MedTech Industries' }
  }
];

const mockTickets: (Ticket & { client?: { company_name: string }; deal?: { name: string }; assigned_user?: { full_name: string } })[] = [
  {
    id: '1',
    title: 'Booth location change request',
    description: 'Client wants to change from Hall A to Hall B due to better visibility',
    client_id: '1',
    deal_id: '1',
    issue_type: 'general',
    priority: 'medium',
    status: 'open',
    sla_due_date: '2024-01-19T12:00:00Z',
    created_at: '2024-01-17T10:00:00Z',
    updated_at: '2024-01-17T10:00:00Z',
    client: { company_name: 'TechCorp Solutions' },
    deal: { name: 'Tech Expo 2024 - Premium Booth A1' }
  },
  {
    id: '2',
    title: 'Payment processing issue',
    description: 'Client reports payment was made but not reflected in system',
    client_id: '2',
    deal_id: '2',
    issue_type: 'billing',
    priority: 'high',
    status: 'in_progress',
    assigned_user_id: '3',
    sla_due_date: '2024-01-18T16:00:00Z',
    created_at: '2024-01-17T08:00:00Z',
    updated_at: '2024-01-17T11:00:00Z',
    client: { company_name: 'MedTech Industries' },
    deal: { name: 'Healthcare Summit - Platinum Sponsorship' },
    assigned_user: { full_name: 'Lisa Chen' }
  },
  {
    id: '3',
    title: 'Technical setup requirements',
    description: 'Client needs special electrical and internet setup for their booth',
    client_id: '1',
    issue_type: 'technical',
    priority: 'medium',
    status: 'resolved',
    assigned_user_id: '2',
    sla_due_date: '2024-01-16T18:00:00Z',
    resolution_notes: 'Coordinated with venue technical team. Setup scheduled for expo day.',
    created_at: '2024-01-15T14:00:00Z',
    updated_at: '2024-01-16T17:30:00Z',
    client: { company_name: 'TechCorp Solutions' },
    assigned_user: { full_name: 'Mike Rodriguez' }
  }
];

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

export default function TasksPage() {
  const [tasks, setTasks] = useState(mockTasks);
  const [tickets, setTickets] = useState(mockTickets);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showCreateTicketDialog, setShowCreateTicketDialog] = useState(false);

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

  const handleCreateTask = (taskData: any) => {
    const newTask = {
      id: Date.now().toString(),
      ...taskData,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by_id: '1' // Current user
    };
    setTasks([...tasks, newTask]);
    setShowCreateTaskDialog(false);
  };

  const handleCreateTicket = (ticketData: any) => {
    const newTicket = {
      id: Date.now().toString(),
      ...ticketData,
      status: 'open' as const,
      sla_due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setTickets([...tickets, newTicket]);
    setShowCreateTicketDialog(false);
  };

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
          <h1 className="text-3xl font-semibold text-crm-primary-text">Tasks & Tickets</h1>
          <p className="text-crm-secondary-text">Manage internal tasks and client support tickets</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button onClick={() => setShowCreateTaskDialog(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
          <Button onClick={() => setShowCreateTicketDialog(true)} className="crm-button-primary">
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

      <Tabs defaultValue="tasks" className="space-y-6">
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
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Task
                            </DropdownMenuItem>
                            {task.status !== 'completed' && (
                              <DropdownMenuItem>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
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
                            {format(new Date(ticket.sla_due_date), 'MMM dd, HH:mm')}
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
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Ticket
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Add Comment
                            </DropdownMenuItem>
                            {ticket.status !== 'resolved' && (
                              <DropdownMenuItem>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark Resolved
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
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
        open={showCreateTaskDialog}
        onOpenChange={setShowCreateTaskDialog}
        onSubmit={handleCreateTask}
      />

      <CreateTicketDialog
        open={showCreateTicketDialog}
        onOpenChange={setShowCreateTicketDialog}
        onSubmit={handleCreateTicket}
      />
    </div>
  );
}