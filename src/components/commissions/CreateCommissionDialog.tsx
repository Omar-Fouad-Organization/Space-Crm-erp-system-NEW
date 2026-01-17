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
import { DollarSign, Percent } from 'lucide-react';

const commissionFormSchema = z.object({
  salesperson_id: z.string().min(1, 'Salesperson is required'),
  deal_id: z.string().min(1, 'Deal is required'),
  payment_id: z.string().min(1, 'Payment is required'),
  commission_percentage: z.number().min(0, 'Commission percentage must be positive').max(100, 'Commission percentage cannot exceed 100%'),
});

type CommissionFormValues = z.infer<typeof commissionFormSchema>;

interface CreateCommissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
}

// Mock data
const mockSalespeople = [
  { id: '1', full_name: 'Sarah Johnson', role: 'sales_executive' },
  { id: '2', full_name: 'Mike Rodriguez', role: 'sales_manager' },
  { id: '3', full_name: 'Lisa Chen', role: 'sales_executive' },
];

const mockDeals = [
  { id: '1', name: 'Tech Expo 2024 - Premium Booth A1', client: 'TechCorp Solutions', value: 120000 },
  { id: '2', name: 'Healthcare Summit - Platinum Sponsorship', client: 'MedTech Industries', value: 89000 },
];

const mockPayments = [
  { id: '1', deal_id: '1', installment_number: 1, amount: 36000, status: 'paid' },
  { id: '2', deal_id: '1', installment_number: 2, amount: 48000, status: 'pending' },
  { id: '3', deal_id: '2', installment_number: 1, amount: 26700, status: 'paid' },
];

export default function CreateCommissionDialog({ open, onOpenChange, onSubmit }: CreateCommissionDialogProps) {
  const form = useForm<CommissionFormValues>({
    resolver: zodResolver(commissionFormSchema),
    defaultValues: {
      salesperson_id: '',
      deal_id: '',
      payment_id: '',
      commission_percentage: 5,
    },
  });

  const watchedDealId = form.watch('deal_id');
  const watchedPaymentId = form.watch('payment_id');
  const watchedCommissionPercentage = form.watch('commission_percentage');

  const availablePayments = mockPayments.filter(payment => 
    watchedDealId ? payment.deal_id === watchedDealId : true
  );

  const selectedPayment = mockPayments.find(p => p.id === watchedPaymentId);
  const commissionAmount = selectedPayment && watchedCommissionPercentage 
    ? (selectedPayment.amount * watchedCommissionPercentage) / 100 
    : 0;

  const handleSubmit = (values: CommissionFormValues) => {
    const selectedPayment = mockPayments.find(p => p.id === values.payment_id);
    const commissionData = {
      ...values,
      commission_amount: selectedPayment ? (selectedPayment.amount * values.commission_percentage) / 100 : 0,
    };

    onSubmit(commissionData);
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
          <DialogTitle>Add Commission Record</DialogTitle>
          <DialogDescription>
            Create a new commission record for a salesperson based on a payment.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Salesperson Selection */}
            <FormField
              control={form.control}
              name="salesperson_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Salesperson *</FormLabel>
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
                  <FormDescription>
                    Select the salesperson who earned this commission
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Deal and Payment Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal *</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('payment_id', ''); // Reset payment when deal changes
                    }} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select deal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mockDeals.map((deal) => (
                          <SelectItem key={deal.id} value={deal.id}>
                            <div>
                              <div className="font-medium">{deal.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {deal.client} • ${deal.value.toLocaleString()}
                              </div>
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
                name="payment_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availablePayments.map((payment) => (
                          <SelectItem key={payment.id} value={payment.id}>
                            <div className="flex justify-between items-center w-full">
                              <div>
                                <div className="font-medium">Installment #{payment.installment_number}</div>
                                <div className="text-xs text-muted-foreground capitalize">{payment.status}</div>
                              </div>
                              <div className="text-sm font-medium">${payment.amount.toLocaleString()}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the payment this commission is based on
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Commission Percentage */}
            <FormField
              control={form.control}
              name="commission_percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commission Percentage *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        placeholder="5"
                        className="pr-10"
                        step="0.1"
                        min="0"
                        max="100"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Commission percentage (0-100%)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Commission Amount Display */}
            {commissionAmount > 0 && (
              <div className="bg-crm-background p-4 rounded-lg border border-crm-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-crm-secondary-text">Commission Amount:</span>
                  <span className="text-lg font-semibold text-crm-primary-text font-tabular">
                    ${commissionAmount.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-crm-secondary-text mt-1">
                  ${selectedPayment?.amount.toLocaleString()} × {watchedCommissionPercentage}% = ${commissionAmount.toLocaleString()}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" className="crm-button-primary">
                Add Commission
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}