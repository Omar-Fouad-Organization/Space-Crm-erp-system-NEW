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
import { DollarSign } from 'lucide-react';
import { CreateBoothForm } from '@/types';

const boothFormSchema = z.object({
  booth_code: z.string().min(1, 'Booth code is required').max(20, 'Booth code too long'),
  expo_id: z.string().min(1, 'Expo is required'),
  hall: z.string().min(1, 'Hall is required'),
  zone: z.string().min(1, 'Zone is required'),
  size_sqm: z.number().min(1, 'Size must be positive'),
  price_per_meter: z.number().min(0, 'Price per meter must be positive'),
});

type BoothFormValues = z.infer<typeof boothFormSchema>;

interface CreateBoothDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateBoothForm) => void;
}

// Mock expos for selection
const mockExpos = [
  { id: '1', name: 'Tech Expo 2024', location: 'Convention Center A' },
  { id: '2', name: 'Healthcare Summit 2024', location: 'Medical Center Hall' },
  { id: '3', name: 'Green Energy Expo 2024', location: 'Eco Center' },
];

const halls = [
  'Hall A',
  'Hall B',
  'Hall C',
  'Main Hall',
  'Exhibition Hall 1',
  'Exhibition Hall 2',
  'Conference Hall',
  'Auditorium'
];

const zones = [
  'Zone 1',
  'Zone 2',
  'Zone 3',
  'Premium Zone',
  'VIP Zone',
  'Standard Zone',
  'Corner Zone',
  'Center Zone'
];

export default function CreateBoothDialog({ open, onOpenChange, onSubmit }: CreateBoothDialogProps) {
  const form = useForm<BoothFormValues>({
    resolver: zodResolver(boothFormSchema),
    defaultValues: {
      booth_code: '',
      expo_id: '',
      hall: '',
      zone: '',
      size_sqm: 0,
      price_per_meter: 0,
    },
  });

  const watchedSize = form.watch('size_sqm');
  const watchedPrice = form.watch('price_per_meter');
  const totalPrice = watchedSize * watchedPrice;

  const handleSubmit = (values: BoothFormValues) => {
    const boothData: CreateBoothForm = {
      booth_code: values.booth_code,
      expo_id: values.expo_id,
      hall: values.hall,
      zone: values.zone,
      size_sqm: values.size_sqm,
      price_per_meter: values.price_per_meter,
    };

    onSubmit(boothData);
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
          <DialogTitle>Create New Booth</DialogTitle>
          <DialogDescription>
            Add a new booth to the inventory. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="booth_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Booth Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., A1-001" {...field} />
                    </FormControl>
                    <FormDescription>
                      Unique identifier for the booth
                    </FormDescription>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
            </div>

            {/* Location Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="hall"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hall *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select hall" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {halls.map((hall) => (
                          <SelectItem key={hall} value={hall}>
                            {hall}
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
                name="zone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zone *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select zone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {zones.map((zone) => (
                          <SelectItem key={zone} value={zone}>
                            {zone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="size_sqm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Size (m²) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="25"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      Booth size in square meters
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price_per_meter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per m² *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="600"
                          className="pl-10"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Price per square meter
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Total Price Display */}
            {totalPrice > 0 && (
              <div className="bg-crm-background p-4 rounded-lg border border-crm-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-crm-secondary-text">Total Price:</span>
                  <span className="text-lg font-semibold text-crm-primary-text font-tabular">
                    ${totalPrice.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-crm-secondary-text mt-1">
                  {watchedSize} m² × ${watchedPrice}/m² = ${totalPrice.toLocaleString()}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" className="crm-button-primary">
                Create Booth
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}