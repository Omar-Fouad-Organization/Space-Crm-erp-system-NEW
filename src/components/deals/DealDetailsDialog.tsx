import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Calendar,
  DollarSign,
  User,
  MapPin,
  Phone,
  Mail,
  Edit,
  Plus,
  FileText,
  CreditCard,
  CheckSquare,
  MessageSquare,
  Clock,
  TrendingUp,
  Store,
  Gift
} from 'lucide-react';
import { Deal, DealStatus, Payment, Task, Document, DealNote } from '@/types';
import { format } from 'date-fns';

interface DealDetailsDialogProps {
  deal: Deal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mock data for deal details
const mockPayments: Payment[] = [
  {
    id: '1',
    deal_id: '1',
    installment_number: 1,
    amount: 36000,
    due_date: '2024-02-01',
    paid_date: '2024-01-28',
    payment_method: 'Bank Transfer',
    status: 'paid',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-28T14:30:00Z'
  },
  {
    id: '2',
    deal_id: '1',
    installment_number: 2,
    amount: 48000,
    due_date: '2024-03-01',
    status: 'pending',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  },
  {
    id: '3',
    deal_id: '1',
    installment_number: 3,
    amount: 36000,
    due_date: '2024-04-01',
    status: 'pending',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  }
];

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Follow up on contract terms',
    description: 'Discuss final terms and conditions with client',
    assigned_user_id: '1',
    created_by_id: '1',
    deal_id: '1',
    due_date: '2024-01-20',
    priority: 'high',
    status: 'in_progress',
    created_at: '2024-01-17T09:00:00Z',
    updated_at: '2024-01-17T09:00:00Z'
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
    updated_at: '2024-01-17T10:00:00Z'
  }
];

const mockDocuments: Document[] = [
  {
    id: '1',
    name: 'Initial Proposal.pdf',
    file_url: '/documents/initial-proposal.pdf',
    file_type: 'application/pdf',
    file_size: 2048576,
    deal_id: '1',
    uploaded_by: '1',
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    name: 'Booth Layout.png',
    file_url: '/documents/booth-layout.png',
    file_type: 'image/png',
    file_size: 1024000,
    deal_id: '1',
    uploaded_by: '1',
    created_at: '2024-01-16T14:00:00Z'
  }
];

const mockNotes: DealNote[] = [
  {
    id: '1',
    deal_id: '1',
    content: 'Initial call went well. Client is interested in premium booth location. Discussed pricing and timeline.',
    created_by: '1',
    created_at: '2024-01-15T10:30:00Z'
  },
  {
    id: '2',
    deal_id: '1',
    content: 'Sent proposal with booth A1 details. Client requested some modifications to the package.',
    created_by: '1',
    created_at: '2024-01-16T15:45:00Z'
  },
  {
    id: '3',
    deal_id: '1',
    content: 'Meeting scheduled for tomorrow to finalize terms. Client seems ready to move forward.',
    created_by: '1',
    created_at: '2024-01-17T11:20:00Z'
  }
];

const dealStatuses: { value: DealStatus; label: string; color: string }[] = [
  { value: 'lead_created', label: 'Lead Created', color: 'bg-gray-100 text-gray-800' },
  { value: 'talking', label: 'Talking', color: 'bg-blue-100 text-blue-800' },
  { value: 'meeting', label: 'Meeting', color: 'bg-green-100 text-green-800' },
  { value: 'strategy_proposal', label: 'Strategy Proposal', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'objection_handling', label: 'Objection Handling', color: 'bg-orange-100 text-orange-800' },
  { value: 'terms_finalized', label: 'Terms Finalized', color: 'bg-purple-100 text-purple-800' },
  { value: 'closed_won', label: 'Closed Won', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'closed_lost', label: 'Closed Lost', color: 'bg-red-100 text-red-800' },
  { value: 'failed', label: 'Failed', color: 'bg-red-100 text-red-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-800' }
];

const getStatusColor = (status: DealStatus) => {
  const statusConfig = dealStatuses.find(s => s.value === status);
  return statusConfig?.color || 'bg-gray-100 text-gray-800';
};

const getStatusLabel = (status: DealStatus) => {
  const statusConfig = dealStatuses.find(s => s.value === status);
  return statusConfig?.label || status;
};

const getPriorityColor = (priority: 'low' | 'medium' | 'high' | 'urgent') => {
  const colors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };
  return colors[priority];
};

const getPaymentStatusColor = (status: string) => {
  const colors = {
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

export default function DealDetailsDialog({ deal, open, onOpenChange }: DealDetailsDialogProps) {
  const [newNote, setNewNote] = useState('');
  const [dealStatus, setDealStatus] = useState(deal.status);

  const totalValue = deal.negotiated_value || deal.expected_value;
  const paidAmount = mockPayments
    .filter(p => p.deal_id === deal.id && p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);
  const paymentProgress = (paidAmount / totalValue) * 100;

  const handleAddNote = () => {
    if (newNote.trim()) {
      // In real app, this would make an API call
      console.log('Adding note:', newNote);
      setNewNote('');
    }
  };

  const handleStatusChange = (newStatus: DealStatus) => {
    setDealStatus(newStatus);
    // In real app, this would make an API call to update the deal
    console.log('Updating deal status to:', newStatus);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">{deal.name}</DialogTitle>
              <DialogDescription className="text-base mt-2">
                Deal ID: {deal.id} • Created {format(new Date(deal.created_at), 'PPP')}
              </DialogDescription>
            </div>
            <div className="flex items-center space-x-3">
              <Select value={dealStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dealStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge className={getStatusColor(dealStatus)}>
                {getStatusLabel(dealStatus)}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Sticky Header with Key Info */}
        <div className="sticky top-0 bg-white border-b border-crm-border pb-4 mb-6 z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="crm-card">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-crm-accent" />
                  <div>
                    <p className="text-sm text-crm-secondary-text">Deal Value</p>
                    <p className="text-lg font-semibold font-tabular">${totalValue.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="crm-card">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5 text-crm-accent" />
                  <div>
                    <p className="text-sm text-crm-secondary-text">Client</p>
                    <p className="text-lg font-semibold">{deal.client?.company_name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="crm-card">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-crm-accent" />
                  <div>
                    <p className="text-sm text-crm-secondary-text">Expo</p>
                    <p className="text-lg font-semibold">{deal.expo?.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="crm-card">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-crm-accent" />
                  <div>
                    <p className="text-sm text-crm-secondary-text">Salesperson</p>
                    <p className="text-lg font-semibold">{deal.assigned_salesperson?.full_name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Deal Information */}
              <Card className="crm-card">
                <CardHeader>
                  <CardTitle>Deal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-crm-secondary-text">Deal Type</p>
                      <div className="flex items-center space-x-2 mt-1">
                        {deal.type === 'booth' && <Store className="h-4 w-4 text-crm-accent" />}
                        {deal.type === 'sponsor' && <Gift className="h-4 w-4 text-crm-accent" />}
                        {deal.type === 'sector_sponsor' && <TrendingUp className="h-4 w-4 text-crm-accent" />}
                        <span className="font-medium capitalize">{deal.type.replace('_', ' ')}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-crm-secondary-text">Expected Close</p>
                      <p className="font-medium mt-1">{format(new Date(deal.expected_close_date), 'PPP')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-crm-secondary-text">Expected Value</p>
                      <p className="font-medium font-tabular mt-1">${deal.expected_value.toLocaleString()}</p>
                    </div>
                    {deal.negotiated_value && (
                      <div>
                        <p className="text-sm text-crm-secondary-text">Negotiated Value</p>
                        <p className="font-medium font-tabular mt-1">${deal.negotiated_value.toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {deal.booth && (
                    <div className="border-t pt-4">
                      <p className="text-sm text-crm-secondary-text mb-2">Booth Details</p>
                      <div className="bg-crm-background p-3 rounded-lg">
                        <p className="font-medium">{deal.booth.booth_code}</p>
                        <p className="text-sm text-crm-secondary-text">{deal.booth.hall} - {deal.booth.zone}</p>
                        <p className="text-sm text-crm-secondary-text">{deal.booth.size_sqm} sqm</p>
                      </div>
                    </div>
                  )}

                  {deal.sponsorship_package && (
                    <div className="border-t pt-4">
                      <p className="text-sm text-crm-secondary-text mb-2">Sponsorship Package</p>
                      <div className="bg-crm-background p-3 rounded-lg">
                        <p className="font-medium">{deal.sponsorship_package.name}</p>
                        <p className="text-sm text-crm-secondary-text capitalize">{deal.sponsorship_package.tier} tier</p>
                        <p className="text-sm text-crm-secondary-text">Base price: ${deal.sponsorship_package.base_price.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Client Information */}
              <Card className="crm-card">
                <CardHeader>
                  <CardTitle>Client Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-crm-secondary-text">Company</p>
                    <p className="font-medium text-lg">{deal.client?.company_name}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-crm-secondary-text" />
                      <span>{deal.client?.contact_person}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-crm-secondary-text" />
                      <span>{deal.client?.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-crm-secondary-text" />
                      <span>{deal.client?.phone}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-crm-secondary-text" />
                      <span>{deal.client?.industry}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payment Progress */}
            <Card className="crm-card">
              <CardHeader>
                <CardTitle>Payment Progress</CardTitle>
                <CardDescription>
                  ${paidAmount.toLocaleString()} of ${totalValue.toLocaleString()} paid
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={paymentProgress} className="h-3" />
                <p className="text-sm text-crm-secondary-text mt-2">
                  {paymentProgress.toFixed(1)}% completed
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card className="crm-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Payment Schedule</CardTitle>
                  <CardDescription>Installment plan and payment tracking</CardDescription>
                </div>
                <Button size="sm" className="crm-button-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Installment</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Paid Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>#{payment.installment_number}</TableCell>
                        <TableCell className="font-tabular font-medium">
                          ${payment.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>{format(new Date(payment.due_date), 'PPP')}</TableCell>
                        <TableCell>
                          {payment.paid_date ? format(new Date(payment.paid_date), 'PPP') : '-'}
                        </TableCell>
                        <TableCell>{payment.payment_method || '-'}</TableCell>
                        <TableCell>
                          <Badge className={getPaymentStatusColor(payment.status)}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks">
            <Card className="crm-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Tasks</CardTitle>
                  <CardDescription>Deal-related tasks and follow-ups</CardDescription>
                </div>
                <Button size="sm" className="crm-button-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockTasks.map((task) => (
                    <div key={task.id} className="border border-crm-border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-crm-primary-text">{task.title}</h4>
                          {task.description && (
                            <p className="text-sm text-crm-secondary-text mt-1">{task.description}</p>
                          )}
                          <div className="flex items-center space-x-4 mt-3">
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                            <div className="flex items-center space-x-1 text-sm text-crm-secondary-text">
                              <Clock className="h-4 w-4" />
                              <span>Due: {format(new Date(task.due_date), 'PPP')}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card className="crm-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Documents</CardTitle>
                  <CardDescription>Proposals, contracts, and other files</CardDescription>
                </div>
                <Button size="sm" className="crm-button-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border border-crm-border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-crm-accent" />
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-xs text-crm-secondary-text">
                            {(doc.file_size / 1024 / 1024).toFixed(1)} MB • {format(new Date(doc.created_at), 'PPP')}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card className="crm-card">
              <CardHeader>
                <CardTitle>Daily Notes</CardTitle>
                <CardDescription>Immutable timeline of deal interactions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Note */}
                <div className="border border-crm-border rounded-lg p-4">
                  <Textarea
                    placeholder="Add a note about this deal..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="mb-3"
                  />
                  <Button onClick={handleAddNote} size="sm" className="crm-button-primary">
                    Add Note
                  </Button>
                </div>

                {/* Notes Timeline */}
                <div className="space-y-4">
                  {mockNotes.map((note) => (
                    <div key={note.id} className="border-l-2 border-crm-accent pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-crm-secondary-text">
                          {format(new Date(note.created_at), 'PPP p')}
                        </p>
                      </div>
                      <p className="text-crm-primary-text">{note.content}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card className="crm-card">
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>Complete history of deal activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-l-2 border-green-500 pl-4">
                    <p className="text-sm text-crm-secondary-text">Today, 2:30 PM</p>
                    <p className="font-medium">Status changed to Terms Finalized</p>
                    <p className="text-sm text-crm-secondary-text">by Sarah Johnson</p>
                  </div>
                  <div className="border-l-2 border-blue-500 pl-4">
                    <p className="text-sm text-crm-secondary-text">Yesterday, 4:15 PM</p>
                    <p className="font-medium">Document uploaded: Contract Draft v2.pdf</p>
                    <p className="text-sm text-crm-secondary-text">by Sarah Johnson</p>
                  </div>
                  <div className="border-l-2 border-yellow-500 pl-4">
                    <p className="text-sm text-crm-secondary-text">2 days ago, 10:00 AM</p>
                    <p className="font-medium">Meeting scheduled with client</p>
                    <p className="text-sm text-crm-secondary-text">by Sarah Johnson</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}