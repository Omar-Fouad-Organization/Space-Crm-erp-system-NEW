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
  role: z.enum(['super_admin', 'management', 'sales_manager', 'sales_executive', 'finance_manager', 'finance_officer', 'operations', 'support', 'hr'], {
    error: 'Role is required',
  }),
  status: z.enum(['active', 'inactive'], {
    error: 'Status is required',
  }),
  password: z.string().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

interface CreateUserDialogProps {
  initialData?: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateUserForm) => Promise<boolean | void> | boolean | void;
}

const roles: { value: UserRole; label: string; description: string }[] = [
  { value: 'super_admin', label: 'Super Admin', description: 'Full system access and control' },
  { value: 'management', label: 'Management', description: 'Management workflows within assigned access' },
  { value: 'sales_manager', label: 'Sales Manager', description: 'Sales role defaults; additional approvals require a grant' },
  { value: 'sales_executive', label: 'Sales Executive', description: 'Handle deals and client relationships' },
  { value: 'finance_manager', label: 'Finance Manager', description: 'Manage financial operations and reports' },
  { value: 'finance_officer', label: 'Finance Officer', description: 'Handle payments and financial records' },
  { value: 'operations', label: 'Operations', description: 'Manage operational tasks and logistics' },
  { value: 'support', label: 'Support', description: 'Handle customer support and tickets' },
  { value: 'hr', label: 'Human Resources', description: 'Manage employee records and authorized payroll fields' }
];

export default function CreateUserDialog({ open, onOpenChange, onSubmit, initialData }: CreateUserDialogProps) {
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

  const randomPassword=()=>Array.from(crypto.getRandomValues(new Uint8Array(18)),n=>n.toString(16).padStart(2,'0')).join('')+'Aa!';
  React.useEffect(()=>{if(!open)return;if(initialData){form.reset({...initialData,password:''});setGeneratePassword(false);}else{form.reset({full_name:'',email:'',role:'sales_executive',status:'active',password:randomPassword()});setGeneratePassword(true);}},[open,initialData,form]);
  const handleSubmit = async (values: UserFormValues) => {
    if((!initialData||values.password)&&String(values.password||'').length<12){form.setError('password',{message:'Use at least 12 characters.'});return;}
    const userData: CreateUserForm = {
      full_name: values.full_name,
      email: values.email,
      role: values.role,
      status: values.status,
      password: values.password || undefined,
    };

    if(await onSubmit(userData)===false)return;
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
          <DialogTitle>{initialData?'Edit User':'Create New User'}</DialogTitle>
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                    onCheckedChange={value=>{setGeneratePassword(value);form.setValue('password',value?randomPassword():'');}}
                  />
                </div>
              </div>

              {(
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{initialData?'Password (leave blank to keep)':'Password *'}</FormLabel>
                      <FormControl>
                        <Input
                          type={generatePassword?'text':'password'}
                          readOnly={generatePassword}
                          placeholder="Enter password"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum 12 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {generatePassword && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    Copy the generated password before saving. Email delivery is not configured.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" className="crm-button-primary">
                {initialData?'Save User':'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
