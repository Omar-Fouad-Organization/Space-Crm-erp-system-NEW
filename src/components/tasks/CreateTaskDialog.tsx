import {useRecordOptions} from '@/hooks/useRecordOptions';
import {useExhibitionField} from '@/components/forms/useExhibitionField';
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CreateTaskForm } from '@/types';

const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().optional(),
  assigned_user_id: z.string().min(1, 'Assigned user is required'),
  deal_id: z.string().optional(),
  client_id: z.string().optional(),
  due_date: z.date({
    error: 'Due date is required',
  }),
  priority: z.enum(['low', 'medium', 'high', 'urgent'], {
    error: 'Priority is required',
  }),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface CreateTaskDialogProps {
  initialData?: any;
  followup?: {meeting_id:number;exhibition_id:number;assignees:any[]};
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateTaskForm) => Promise<boolean | void> | boolean | void;
}

// Mock data
const mockUsers = [
  { id: '1', full_name: 'Sarah Johnson', role: 'sales_executive' },
  { id: '2', full_name: 'Mike Rodriguez', role: 'sales_manager' },
  { id: '3', full_name: 'Lisa Chen', role: 'operations' },
];

const mockDeals = [
  { id: '1', name: 'Tech Expo 2024 - Premium Booth A1', client: 'TechCorp Solutions' },
  { id: '2', name: 'Healthcare Summit - Platinum Sponsorship', client: 'MedTech Industries' },
];

const mockClients = [
  { id: '1', company_name: 'TechCorp Solutions' },
  { id: '2', company_name: 'MedTech Industries' },
  { id: '3', company_name: 'EcoSolutions Ltd' },
];

export default function CreateTaskDialog({ open, onOpenChange, onSubmit, initialData, followup }: CreateTaskDialogProps) {
  const exhibition=useExhibitionField(open,'task-exhibition',initialData);
  const users=useRecordOptions('users',open&&!followup);
  const mockUsers=followup?.assignees||users;
  const mockClients=useRecordOptions('clients',open&&!followup);
  const mockDeals=useRecordOptions('deals',open&&!followup);
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      assigned_user_id: '',
      deal_id: '',
      client_id: '',
      due_date: undefined,
      priority: 'medium',
    },
  });

  React.useEffect(()=>{if(open&&initialData)form.reset({...initialData,...(initialData.due_date?{due_date:new Date(initialData.due_date+'T12:00:00')}: {})});},[open,initialData,form]);

  const handleSubmit = async (values: TaskFormValues) => {
    const taskData: CreateTaskForm = {
      title: values.title,
      description: values.description,
      assigned_user_id: values.assigned_user_id,
      deal_id: values.deal_id,
      client_id: values.client_id,
      due_date: format(values.due_date,'yyyy-MM-dd'),
      priority: values.priority,
    };

    if(await onSubmit({...taskData,...(followup?{exhibition_id:followup.exhibition_id}:exhibition.payload)})===false)return;
    form.reset();
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{followup?'Create Follow-up Task':initialData?'Edit Task':'Create New Task'}</DialogTitle>
          <DialogDescription>
            Create a new task and assign it to a team member.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Information */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Follow up with client on contract terms" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional details about the task..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional description with more details
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Assignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="assigned_user_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mockUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div>
                              <div className="font-medium">{user.full_name}</div>
                              <div className="text-xs text-muted-foreground capitalize">{user.role.replace('_', ' ')}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {followup&&<p>Source B2B meeting #{followup.meeting_id} · Exhibition #{followup.exhibition_id}. Only enter information the assignee may access. Internal B2B notes are not copied.</p>}
            {/* Related Items */}
            {!followup&&<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Deal</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select deal (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No deal selected</SelectItem>
                        {mockDeals.map((deal) => (
                          <SelectItem key={deal.id} value={deal.id}>
                            <div>
                              <div className="font-medium">{deal.name}</div>
                              <div className="text-xs text-muted-foreground">{deal.client}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Link this task to a specific deal
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Client</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No client selected</SelectItem>
                        {mockClients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Link this task to a specific client
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>}

            {/* Due Date */}
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick due date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!followup&&exhibition.field}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" className="crm-button-primary">
                {followup?'Create Follow-up Task':initialData?'Save Task':'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
