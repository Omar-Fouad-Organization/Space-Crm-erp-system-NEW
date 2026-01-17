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
import { Switch } from '@/components/ui/switch';
import { CreateUserForm, UserRole } from '@/types';

const userFormSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(100, 'Full name too long'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['super_admin', 'management', 'sales_manager', 'sales_executive', 'finance_manager', 'finance_officer', 'operations', 'support', 'client'], {
    required_error: 'Role is required',
  }),
  status: z.enum(['active', 'inactive'], {
    required_error: 'Status is required',
  }),
  password: z.string().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateUserForm) => void;
}

const roles: { value: UserRole; label: string; description: string }[] = [
  { value: 'super_admin', label: 'Super Admin', description: 'Full system access and control' },
  { value: 'management', label: 'Management', description: 'Executive level access to all modules' },
  { value: 'sales_manager', label: 'Sales Manager', description: 'Manage sales team and approve deals' },
  { value: 'sales_executive', label: 'Sales Executive', description: 'Handle deals and client relationships' },
  { value: 'finance_manager', label: 'Finance Manager', description: 'Manage financial operations and reports' },
  { value: 'finance_officer', label: 'Finance Officer', description: 'Handle payments and financial records' },
  { value: 'operations', label: 'Operations', description: 'Manage operational tasks and logistics' },
  { value: 'support', label: 'Support', description: 'Handle customer support and tickets' },
  { value: 'client', label: 'Client', description: 'Limited access to client portal only' }
];

export default function CreateUserDialog({ open, onOpenChange, onSubmit }: CreateUserDialogProps) {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      full_name: '',
      email: '',
      role: 'sales_executive',
      status: 'active',
      password: '',
    },
  });

  const [generatePassword, setGeneratePassword] = React.useState(true);

  const handleSubmit = (values: UserFormValues) => {
    const userData: CreateUserForm = {
      full_name: values.full_name,
      email: values.email,
      role: values.role,
      status: values.status,
      password: generatePassword ? undefined : values.password,
    };

    onSubmit(userData);
    form.reset();
    setGeneratePassword(true);
  };

  const handleClose = () => {
    form.reset();
    setGeneratePassword(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to the system with appropriate role and permissions.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., john@spaceorganizing.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      This will be used for login and notifications
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Role and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            <div>
                              <div className="font-medium">{role.label}</div>
                              <div className="text-xs text-muted-foreground">{role.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Role determines user permissions and access levels
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      User account status
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Password Setup */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Password Setup</h3>
                  <p className="text-xs text-muted-foreground">
                    Choose how to set up the user's password
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <label htmlFor="generate-password" className="text-sm">
                    Auto-generate password
                  </label>
                  <Switch
                    id="generate-password"
                    checked={generatePassword}
                    onCheckedChange={setGeneratePassword}
                  />
                </div>
              </div>

              {!generatePassword && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password *</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter password"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum 8 characters with letters and numbers
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {generatePassword && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    A secure password will be automatically generated and sent to the user's email address.
                    The user will be prompted to change it on first login.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" className="crm-button-primary">
                Create User
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}