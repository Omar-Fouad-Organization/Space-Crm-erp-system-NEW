import {useRecordOptions} from '@/hooks/useRecordOptions';
import React, { useState } from 'react';
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
import { CalendarIcon, DollarSign } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CreateDealForm } from '@/types';

const dealFormSchema = z.object({
  name: z.string().min(1, 'Deal name is required').max(100, 'Deal name too long'),
  client_id: z.string().min(1, 'Client is required'),
  expo_id: z.string().min(1, 'Expo is required'),
  type: z.enum(['booth', 'sponsor', 'sector_sponsor'], {
    error: 'Deal type is required',
  }),
  assigned_salesperson_id: z.string().min(1, 'Salesperson is required'),
  expected_value: z.number().min(0, 'Expected value must be positive'),
  expected_close_date: z.date({
    error: 'Expected close date is required',
  }),
  booth_id: z.string().optional(),
  sponsorship_package_id: z.string().optional(),
  notes: z.string().optional(),
});

type DealFormValues = z.infer<typeof dealFormSchema>;

interface CreateDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateDealForm) => void;
}

// Mock data - in real app, these would come from API
const mockClients = [
  { id: '1', company_name: 'TechCorp Solutions', type: 'exhibitor' },
  { id: '2', company_name: 'MedTech Industries', type: 'sponsor' },
  { id: '3', company_name: 'EcoSolutions Ltd', type: 'exhibitor' },
  { id: '4', company_name: 'FinanceFirst Corp', type: 'sector_sponsor' },
];

const mockExpos = [
  { id: '1', name: 'Tech Expo 2024', location: 'Convention Center A' },
  { id: '2', name: 'Healthcare Summit 2024', location: 'Medical Center Hall' },
  { id: '3', name: 'Green Energy Expo 2024', location: 'Eco Center' },
];

const mockSalespeople = [
  { id: '1', full_name: 'Sarah Johnson', role: 'sales_executive' },
  { id: '2', full_name: 'Mike Rodriguez', role: 'sales_manager' },
  { id: '3', full_name: 'Lisa Chen', role: 'sales_executive' },
];

const mockBooths = [
  { id: '1', booth_code: 'A1-001', hall: 'Hall A', zone: 'Zone 1', total_price: 15000 },
  { id: '2', booth_code: 'A1-002', hall: 'Hall A', zone: 'Zone 1', total_price: 18000 },
  { id: '3', booth_code: 'B2-001', hall: 'Hall B', zone: 'Zone 2', total_price: 12000 },
];

const mockSponsorshipPackages = [
  { id: '1', name: 'Platinum Package', tier: 'platinum', base_price: 50000, package_type: 'sponsor' },
  { id: '2', name: 'Gold Package', tier: 'gold', base_price: 30000, package_type: 'sponsor' },
  { id: '3', name: 'Healthcare Sector Platinum', tier: 'platinum', base_price: 75000, package_type: 'sector_sponsor' },
];

export default function CreateDealDialog({ open, onOpenChange, onSubmit }: CreateDealDialogProps) {
  const mockClients=useRecordOptions('clients',open);
  const mockExpos=useRecordOptions('exhibitions',open);
  const mockBooths=useRecordOptions('booths',open);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedExpo, setSelectedExpo] = useState<string>('');

  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      name: '',
      client_id: '',
      expo_id: '',
      type: undefined,
      assigned_salesperson_id: '',
      expected_value: 0,
      expected_close_date: undefined,
      booth_id: '',
      sponsorship_package_id: '',
      notes: '',
    },
  });

  const watchedType = form.watch('type');
  const watchedBoothId = form.watch('booth_id');
  const watchedSponsorshipId = form.watch('sponsorship_package_id');

  // Auto-populate expected value based on selection
  React.useEffect(() => {
    if (watchedType === 'booth' && watchedBoothId) {
      const booth = mockBooths.find(b => b.id === watchedBoothId);
      if (booth) {
        form.setValue('expected_value', booth.total_price);
      }
    } else if ((watchedType === 'sponsor' || watchedType === 'sector_sponsor') && watchedSponsorshipId) {
      const package_ = mockSponsorshipPackages.find(p => p.id === watchedSponsorshipId);
      if (package_) {
        form.setValue('expected_value', package_.base_price);
      }
    }
  }, [watchedType, watchedBoothId, watchedSponsorshipId, form]);

  const handleSubmit = (values: DealFormValues) => {
    const dealData: CreateDealForm = {
      name: values.name,
      client_id: values.client_id,
      expo_id: values.expo_id,
      type: values.type,
      assigned_salesperson_id: values.assigned_salesperson_id,
      expected_value: values.expected_value,
      expected_close_date: values.expected_close_date.toISOString(),
    };

    onSubmit(dealData);
    form.reset();
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  const availableBooths = mockBooths.filter(booth =>
    selectedExpo ? booth.id.startsWith(selectedExpo) : true
  );

  const availableSponsorshipPackages = mockSponsorshipPackages.filter(pkg =>
    watchedType === 'sector_sponsor'
      ? pkg.package_type === 'sector_sponsor'
      : pkg.package_type === 'sponsor'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
          <DialogDescription>
            Create a new deal in the sales pipeline. Fill in all required information.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Deal Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Tech Expo 2024 - Premium Booth" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mockClients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            <div>
                              <div className="font-medium">{client.company_name}</div>
                              <div className="text-xs text-muted-foreground capitalize">{client.type}</div>
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
                name="expo_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expo *</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedExpo(value);
                    }} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select expo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mockExpos.map((expo) => (
                          <SelectItem key={expo.id} value={expo.id}>
                            <div>
                              <div className="font-medium">{expo.name}</div>
                              <div className="text-xs text-muted-foreground">{expo.location}</div>
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Type *</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedType(value);
                      // Reset dependent fields when type changes
                      form.setValue('booth_id', '');
                      form.setValue('sponsorship_package_id', '');
                      form.setValue('expected_value', 0);
                    }} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select deal type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="booth">Booth</SelectItem>
                        <SelectItem value="sponsor">Sponsor</SelectItem>
                        <SelectItem value="sector_sponsor">Sector Sponsor</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assigned_salesperson_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Salesperson *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select salesperson" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mockSalespeople.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            <div>
                              <div className="font-medium">{person.full_name}</div>
                              <div className="text-xs text-muted-foreground capitalize">{person.role.replace('_', ' ')}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Conditional Fields Based on Deal Type */}
            {watchedType === 'booth' && (
              <FormField
                control={form.control}
                name="booth_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Booth</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select booth" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableBooths.map((booth) => (
                          <SelectItem key={booth.id} value={booth.id}>
                            <div className="flex justify-between items-center w-full">
                              <div>
                                <div className="font-medium">{booth.booth_code}</div>
                                <div className="text-xs text-muted-foreground">{booth.hall} - {booth.zone}</div>
                              </div>
                              <div className="text-sm font-medium">${booth.total_price.toLocaleString()}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Booth selection will auto-populate the expected value
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {(watchedType === 'sponsor' || watchedType === 'sector_sponsor') && (
              <FormField
                control={form.control}
                name="sponsorship_package_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Sponsorship Package</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select package" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableSponsorshipPackages.map((pkg) => (
                          <SelectItem key={pkg.id} value={pkg.id}>
                            <div className="flex justify-between items-center w-full">
                              <div>
                                <div className="font-medium">{pkg.name}</div>
                                <div className="text-xs text-muted-foreground capitalize">{pkg.tier} tier</div>
                              </div>
                              <div className="text-sm font-medium">${pkg.base_price.toLocaleString()}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Package selection will auto-populate the expected value
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Financial Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="expected_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Value *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="0"
                          className="pl-10"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expected_close_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Close Date *</FormLabel>
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
                              <span>Pick a date</span>
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
                            date < new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" className="crm-button-primary">
                Create Deal
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}