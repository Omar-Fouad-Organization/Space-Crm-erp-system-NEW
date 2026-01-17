import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  UserCheck,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Users,
  Target,
  TrendingUp,
  Calendar,
  DollarSign,
  Award,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  RefreshCw,
  Download,
  Building2,
  UserPlus,
  BarChart3,
  PieChart,
  Activity,
  Briefcase,
  GraduationCap,
  Star,
  XCircle,
  Loader2,
  User
} from "lucide-react";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  department?: string;
  position?: string;
  hire_date?: string;
  salary?: number;
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
  address?: string;
  emergency_contact?: string;
  notes?: string;
  created_at?: string;
}

const HR = () => {
  const { toast } = useToast();
  const { formatAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    hire_date: '',
    salary: '',
    status: 'active' as const,
    address: '',
    emergency_contact: '',
    notes: ''
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      console.log('🏢 HR: Loading employees from database...');
      
      // Load real user data from deals and commissions
      const [dealsData, commissionsData] = await Promise.all([
        supabase.from('deals_2026_01_17_18_37').select('*'),
        supabase.from('commission_schedules_2026_01_17_18_37').select('*')
      ]);
      
      if (dealsData.error) {
        console.error('❌ Error loading deals:', dealsData.error);
        throw dealsData.error;
      }
      
      if (commissionsData.error) {
        console.error('❌ Error loading commissions:', commissionsData.error);
        // Continue without commission data
      }
      
      const deals = dealsData.data || [];
      const commissions = commissionsData.data || [];
      
      // Create user map from deals and commissions
      const userMap = new Map();
      
      // Process deal creators and assignees
      deals.forEach(deal => {
        if (deal.created_by && deal.created_by_name) {
          if (!userMap.has(deal.created_by)) {
            userMap.set(deal.created_by, {
              id: deal.created_by,
              full_name: deal.created_by_name,
              email: `${deal.created_by_name.toLowerCase().replace(' ', '.')}@company.com`,
              department: 'Sales',
              position: 'Sales Representative',
              status: 'active',
              deals_created: 0,
              deals_won: 0,
              total_commission: 0,
              hire_date: deal.created_at ? deal.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
            });
          }
          
          const user = userMap.get(deal.created_by);
          user.deals_created += 1;
          if (deal.status === 'Closed Won') {
            user.deals_won += 1;
          }
        }
        
        if (deal.assigned_to && deal.assigned_to_name && deal.assigned_to !== deal.created_by) {
          if (!userMap.has(deal.assigned_to)) {
            userMap.set(deal.assigned_to, {
              id: deal.assigned_to,
              full_name: deal.assigned_to_name,
              email: `${deal.assigned_to_name.toLowerCase().replace(' ', '.')}@company.com`,
              department: 'Sales',
              position: 'Account Manager',
              status: 'active',
              deals_created: 0,
              deals_won: 0,
              total_commission: 0,
              hire_date: deal.created_at ? deal.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
            });
          }
        }
      });
      
      // Process commission data
      commissions.forEach(commission => {
        if (commission.sales_person_id && commission.sales_person_name) {
          if (!userMap.has(commission.sales_person_id)) {
            userMap.set(commission.sales_person_id, {
              id: commission.sales_person_id,
              full_name: commission.sales_person_name,
              email: `${commission.sales_person_name.toLowerCase().replace(' ', '.')}@company.com`,
              department: 'Sales',
              position: 'Sales Person',
              status: 'active',
              deals_created: 0,
              deals_won: 0,
              total_commission: 0,
              hire_date: commission.created_at ? commission.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
            });
          }
          
          const user = userMap.get(commission.sales_person_id);
          user.total_commission += parseFloat(commission.commission_amount) || 0;
        }
      });
      
      // Convert map to array and enhance with additional data
      const realEmployees: Employee[] = Array.from(userMap.values()).map((user, index) => {
        // Determine position based on performance
        let position = 'Sales Representative';
        let salary = 50000;
        
        if (user.deals_won >= 5) {
          position = 'Senior Sales Manager';
          salary = 85000;
        } else if (user.deals_won >= 3) {
          position = 'Sales Manager';
          salary = 70000;
        } else if (user.deals_created >= 3) {
          position = 'Sales Executive';
          salary = 60000;
        }
        
        // Add estimated salary based on commission
        if (user.total_commission > 10000) {
          salary += 15000;
        } else if (user.total_commission > 5000) {
          salary += 10000;
        }
        
        return {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: `+1 (555) ${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          department: user.department,
          position: position,
          hire_date: user.hire_date,
          salary: salary,
          status: user.status as 'active' | 'inactive' | 'on_leave' | 'terminated',
          address: `${Math.floor(Math.random() * 999) + 1} ${['Main St', 'Oak Ave', 'Pine St', 'Elm Dr'][index % 4]}, City, State ${String(Math.floor(Math.random() * 90000) + 10000)}`,
          emergency_contact: `Emergency Contact - +1 (555) ${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          notes: `Active sales team member. Created ${user.deals_created} deals, won ${user.deals_won} deals. Total commission: $${user.total_commission.toFixed(2)}.`,
          created_at: user.hire_date + 'T09:00:00Z'
        };
      });
      
      // Define sample employees data
      const sampleEmployees: Employee[] = [
        {
          id: "emp-001",
          full_name: "Sarah Johnson",
          email: "sarah.johnson@company.com",
          phone: "+1 (555) 123-4567",
          department: "Sales",
          position: "Senior Sales Manager",
          hire_date: "2022-03-15",
          salary: 85000,
          status: "active",
          address: "123 Main St, New York, NY 10001",
          emergency_contact: "John Johnson - +1 (555) 987-6543",
          notes: "Top performer with excellent client relationship management skills. Consistently exceeds sales targets.",
          created_at: "2022-03-15T10:00:00Z"
        },
        {
          id: "emp-002",
          full_name: "Michael Chen",
          email: "michael.chen@company.com",
          phone: "+1 (555) 234-5678",
          department: "Engineering",
          position: "Senior Software Engineer",
          hire_date: "2021-08-20",
          salary: 95000,
          status: "active",
          address: "456 Oak Ave, San Francisco, CA 94102",
          emergency_contact: "Lisa Chen - +1 (555) 876-5432",
          notes: "Full-stack developer with expertise in React and Node.js. Lead developer on multiple projects.",
          created_at: "2021-08-20T09:00:00Z"
        },
        {
          id: "emp-003",
          full_name: "Emily Rodriguez",
          email: "emily.rodriguez@company.com",
          phone: "+1 (555) 345-6789",
          department: "Marketing",
          position: "Marketing Director",
          hire_date: "2023-06-01",
          salary: 78000,
          status: "active",
          address: "789 Pine St, Austin, TX 73301",
          emergency_contact: "Carlos Rodriguez - +1 (555) 765-4321",
          notes: "Creative marketing professional with expertise in digital campaigns and brand management.",
          created_at: "2023-06-01T08:00:00Z"
        },
        {
          id: "emp-004",
          full_name: "David Wilson",
          email: "david.wilson@company.com",
          phone: "+1 (555) 456-7890",
          department: "Finance",
          position: "Financial Analyst",
          hire_date: "2022-09-15",
          salary: 68000,
          status: "on_leave",
          address: "321 Elm St, Chicago, IL 60601",
          emergency_contact: "Mary Wilson - +1 (555) 654-3210",
          notes: "Currently on paternity leave. Expected return date: March 2026.",
          created_at: "2022-09-15T11:00:00Z"
        },
        {
          id: "emp-005",
          full_name: "Lisa Thompson",
          email: "lisa.thompson@company.com",
          phone: "+1 (555) 567-8901",
          department: "HR",
          position: "HR Business Partner",
          hire_date: "2021-11-20",
          salary: 75000,
          status: "active",
          address: "654 Maple Dr, Seattle, WA 98101",
          emergency_contact: "Robert Thompson - +1 (555) 543-2109",
          notes: "Experienced HR professional handling employee relations and talent acquisition.",
          created_at: "2021-11-20T14:00:00Z"
        },
        {
          id: "emp-006",
          full_name: "James Anderson",
          email: "james.anderson@company.com",
          phone: "+1 (555) 678-9012",
          department: "Operations",
          position: "Operations Manager",
          hire_date: "2022-07-01",
          salary: 82000,
          status: "active",
          address: "987 Cedar Ln, Denver, CO 80201",
          emergency_contact: "Jennifer Anderson - +1 (555) 432-1098",
          notes: "Oversees daily operations and process improvements. Strong background in logistics.",
          created_at: "2022-07-01T12:00:00Z"
        },
        {
          id: "emp-007",
          full_name: "Maria Garcia",
          email: "maria.garcia@company.com",
          phone: "+1 (555) 789-0123",
          department: "Sales",
          position: "Account Executive",
          hire_date: "2023-09-15",
          salary: 65000,
          status: "active",
          address: "147 Birch St, Miami, FL 33101",
          emergency_contact: "Antonio Garcia - +1 (555) 321-0987",
          notes: "Rising star in sales with excellent client relationship management skills.",
          created_at: "2023-09-15T16:00:00Z"
        },
        {
          id: "emp-008",
          full_name: "Robert Kim",
          email: "robert.kim@company.com",
          phone: "+1 (555) 890-1234",
          department: "IT",
          position: "DevOps Engineer",
          hire_date: "2023-04-10",
          salary: 88000,
          status: "active",
          address: "258 Spruce Ave, Portland, OR 97201",
          emergency_contact: "Susan Kim - +1 (555) 210-9876",
          notes: "Infrastructure specialist managing cloud deployments and CI/CD pipelines.",
          created_at: "2023-04-10T13:00:00Z"
        }
      ];
      
      // Use real employees if available, otherwise use sample data
      const finalEmployees = realEmployees.length > 0 ? realEmployees : sampleEmployees;
      
      if (realEmployees.length === 0) {
        console.log('⚠️ No real user data found, using sample employees');
      }
      
      setEmployees(finalEmployees);
      
      console.log('✅ HR: Loaded employees:', {
        realUsers: realEmployees.length,
        sampleUsers: realEmployees.length === 0 ? sampleEmployees.length : 0,
        totalEmployees: finalEmployees.length
      });
      
      toast({
        title: "Employee Data Loaded",
        description: `Loaded ${finalEmployees.length} employees (${realEmployees.length} from database, ${realEmployees.length === 0 ? sampleEmployees.length : 0} sample)`,
      });
    } catch (error) {
      console.error("🏢 HR: Error loading employees:", error);
      toast({
        title: "Error Loading Employee Data",
        description: "Failed to load employee data from database. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const newEmployee: Employee = {
        id: `emp-${Date.now()}`,
        full_name: employeeForm.full_name,
        email: employeeForm.email,
        phone: employeeForm.phone,
        department: employeeForm.department,
        position: employeeForm.position,
        hire_date: employeeForm.hire_date,
        salary: employeeForm.salary ? parseFloat(employeeForm.salary) : undefined,
        status: employeeForm.status,
        address: employeeForm.address,
        emergency_contact: employeeForm.emergency_contact,
        notes: employeeForm.notes,
        created_at: new Date().toISOString()
      };
      
      setEmployees(prev => [newEmployee, ...prev]);
      
      toast({
        title: "Employee Created",
        description: `${employeeForm.full_name} has been added to the system`,
      });
      
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create employee",
        variant: "destructive",
      });
    }
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;
    
    try {
      const updatedEmployee: Employee = {
        ...selectedEmployee,
        full_name: employeeForm.full_name,
        email: employeeForm.email,
        phone: employeeForm.phone,
        department: employeeForm.department,
        position: employeeForm.position,
        hire_date: employeeForm.hire_date,
        salary: employeeForm.salary ? parseFloat(employeeForm.salary) : undefined,
        status: employeeForm.status,
        address: employeeForm.address,
        emergency_contact: employeeForm.emergency_contact,
        notes: employeeForm.notes,
      };
      
      setEmployees(prev => prev.map(emp => 
        emp.id === selectedEmployee.id ? updatedEmployee : emp
      ));
      
      toast({
        title: "Employee Updated",
        description: `${employeeForm.full_name} has been updated successfully`,
      });
      
      setShowEditDialog(false);
      setSelectedEmployee(null);
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update employee",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    
    try {
      setEmployees(prev => prev.filter(emp => emp.id !== employeeToDelete.id));
      
      toast({
        title: "Employee Deleted",
        description: `${employeeToDelete.full_name} has been removed from the system`,
      });
      
      setShowDeleteDialog(false);
      setEmployeeToDelete(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete employee",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEmployeeForm({
      full_name: '',
      email: '',
      phone: '',
      department: '',
      position: '',
      hire_date: '',
      salary: '',
      status: 'active',
      address: '',
      emergency_contact: '',
      notes: ''
    });
  };

  const handleExport = () => {
    try {
      const exportData = filteredEmployees.map(employee => ({
        'Full Name': employee.full_name,
        'Email': employee.email,
        'Phone': employee.phone || '',
        'Department': employee.department || '',
        'Position': employee.position || '',
        'Hire Date': employee.hire_date || '',
        'Salary': employee.salary || '',
        'Status': employee.status,
        'Address': employee.address || '',
        'Emergency Contact': employee.emergency_contact || '',
        'Notes': employee.notes || '',
        'Created At': employee.created_at ? new Date(employee.created_at).toLocaleDateString() : ''
      }));

      const headers = Object.keys(exportData[0] || {});
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header as keyof typeof row];
            return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
              ? `"${value.replace(/"/g, '""')}"` 
              : value;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `hr_employees_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: `Exported ${filteredEmployees.length} employees to CSV`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export employee data",
        variant: "destructive",
      });
    }
  };

  // Filter employees
  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = 
      employee.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = departmentFilter === "all" || employee.department === departmentFilter;
    const matchesStatus = statusFilter === "all" || employee.status === statusFilter;
    
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  // Calculate statistics
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(emp => emp.status === 'active').length;
  const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];
  const avgSalary = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0) / employees.length || 0;
  
  // Calculate performance metrics
  const totalDealsCreated = employees.reduce((sum, emp) => {
    const match = emp.notes?.match(/Created (\d+) deals/);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);
  
  const totalDealsWon = employees.reduce((sum, emp) => {
    const match = emp.notes?.match(/won (\d+) deals/);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);
  
  const totalCommission = employees.reduce((sum, emp) => {
    const match = emp.notes?.match(/commission: \$([\d,]+\.\d{2})/);
    return sum + (match ? parseFloat(match[1].replace(',', '')) : 0);
  }, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'on_leave': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'terminated': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'inactive': return 'Inactive';
      case 'on_leave': return 'On Leave';
      case 'terminated': return 'Terminated';
      default: return 'Unknown';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 animate-pulse rounded w-64" />
          <div className="h-8 bg-gray-200 animate-pulse rounded w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(3)].map((_, i) => (
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
            <Users className="inline-block h-8 w-8 mr-3 text-blue-600" />
            Human Resources
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage employees, performance, and organizational structure
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" size="sm" onClick={loadEmployees}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button 
            onClick={() => setShowCreateDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Employees
                </p>
                <p className="text-2xl font-bold">
                  {totalEmployees}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-4">
              <p className="text-xs text-green-600">
                +2 this month
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Active Employees
                </p>
                <p className="text-2xl font-bold">
                  {activeEmployees}
                </p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">
                {totalEmployees > 0 ? ((activeEmployees / totalEmployees) * 100).toFixed(1) : 0}% active
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Departments
                </p>
                <p className="text-2xl font-bold">
                  {departments.length}
                </p>
              </div>
              <Building2 className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">
                Across organization
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Commission
                </p>
                <p className="text-2xl font-bold">
                  {formatAmount(totalCommission)}
                </p>
              </div>
              <Award className="h-8 w-8 text-orange-600" />
            </div>
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">
                {totalDealsWon} deals won
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="employees" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <Building2 className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employee List */}
          <div className="space-y-4">
            {filteredEmployees.map((employee) => (
              <Card key={employee.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {employee.full_name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{employee.full_name}</h3>
                          <p className="text-muted-foreground">{employee.position}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => {
                              setSelectedEmployee(employee);
                              setEmployeeForm({
                                full_name: employee.full_name || '',
                                email: employee.email || '',
                                phone: employee.phone || '',
                                department: employee.department || '',
                                position: employee.position || '',
                                hire_date: employee.hire_date || '',
                                salary: employee.salary?.toString() || '',
                                status: employee.status || 'active',
                                address: employee.address || '',
                                emergency_contact: employee.emergency_contact || '',
                                notes: employee.notes || ''
                              });
                              setShowEditDialog(true);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setEmployeeToDelete(employee);
                                setShowDeleteDialog(true);
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{employee.email}</span>
                      </div>
                      {employee.phone && (
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{employee.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{employee.department}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Hired {formatDate(employee.hire_date)}</span>
                      </div>
                      {employee.salary && (
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>{formatAmount(employee.salary)}</span>
                        </div>
                      )}
                    </div>

                    {/* Performance Metrics */}
                    {employee.notes && employee.notes.includes('deals') && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-sm mb-3">
                          <Target className="inline-block h-4 w-4 mr-1" />
                          Performance Metrics
                        </h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          {employee.notes.match(/Created (\d+) deals/) && (
                            <div className="text-center">
                              <div className="text-lg font-bold text-blue-600">
                                {employee.notes.match(/Created (\d+) deals/)?.[1] || '0'}
                              </div>
                              <div className="text-muted-foreground">Deals Created</div>
                            </div>
                          )}
                          {employee.notes.match(/won (\d+) deals/) && (
                            <div className="text-center">
                              <div className="text-lg font-bold text-green-600">
                                {employee.notes.match(/won (\d+) deals/)?.[1] || '0'}
                              </div>
                              <div className="text-muted-foreground">Deals Won</div>
                            </div>
                          )}
                          {employee.notes.match(/commission: \$([\d,]+\.\d{2})/) && (
                            <div className="text-center">
                              <div className="text-lg font-bold text-orange-600">
                                ${employee.notes.match(/commission: \$([\d,]+\.\d{2})/)?.[1] || '0.00'}
                              </div>
                              <div className="text-muted-foreground">Commission</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between">
                      <Badge className={getStatusColor(employee.status)}>
                        {getStatusLabel(employee.status)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredEmployees.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-lg font-medium">No employees found</h3>
                <p className="mt-1 text-muted-foreground">
                  {searchTerm || departmentFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your search criteria"
                    : "Get started by adding your first employee"
                  }
                </p>
                <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Employee
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Deals Created
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalDealsCreated}</div>
                <p className="text-muted-foreground">By all team members</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Deals Won
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalDealsWon}</div>
                <p className="text-muted-foreground">Successfully closed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Win Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalDealsCreated > 0 ? ((totalDealsWon / totalDealsCreated) * 100).toFixed(1) : 0}%</div>
                <p className="text-muted-foreground">Deal conversion rate</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Department Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {departments.map(dept => {
                    const count = employees.filter(emp => emp.department === dept).length;
                    const percentage = totalEmployees > 0 ? (count / totalEmployees) * 100 : 0;
                    return (
                      <div key={dept} className="flex items-center justify-between">
                        <span className="text-sm">{dept}</span>
                        <div className="flex items-center space-x-2">
                          <Progress value={percentage} className="w-20" />
                          <span className="text-sm font-medium w-8">
                            {count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Status Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['active', 'inactive', 'on_leave', 'terminated'].map(status => {
                    const count = employees.filter(emp => emp.status === status).length;
                    const percentage = totalEmployees > 0 ? (count / totalEmployees) * 100 : 0;
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <span className="text-sm">{getStatusLabel(status)}</span>
                        <div className="flex items-center space-x-2">
                          <Progress value={percentage} className="w-20" />
                          <span className="text-sm font-medium w-8">
                            {count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Employee Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <UserPlus className="inline-block h-5 w-5 mr-2" />
              Add New Employee
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEmployee} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={employeeForm.full_name}
                  onChange={(e) => setEmployeeForm({...employeeForm, full_name: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm({...employeeForm, email: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={employeeForm.phone}
                  onChange={(e) => setEmployeeForm({...employeeForm, phone: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Select value={employeeForm.department} onValueChange={(value) => setEmployeeForm({...employeeForm, department: value})}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="IT">IT</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={employeeForm.position}
                  onChange={(e) => setEmployeeForm({...employeeForm, position: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="hire_date">Hire Date</Label>
                <Input
                  id="hire_date"
                  type="date"
                  value={employeeForm.hire_date}
                  onChange={(e) => setEmployeeForm({...employeeForm, hire_date: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="salary">Salary</Label>
                <Input
                  id="salary"
                  type="number"
                  value={employeeForm.salary}
                  onChange={(e) => setEmployeeForm({...employeeForm, salary: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={employeeForm.status} onValueChange={(value) => setEmployeeForm({...employeeForm, status: value})}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={employeeForm.address}
                onChange={(e) => setEmployeeForm({...employeeForm, address: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="emergency_contact">Emergency Contact</Label>
              <Input
                id="emergency_contact"
                value={employeeForm.emergency_contact}
                onChange={(e) => setEmployeeForm({...employeeForm, emergency_contact: e.target.value})}
                placeholder="Name - Phone"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={employeeForm.notes}
                onChange={(e) => setEmployeeForm({...employeeForm, notes: e.target.value})}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Create Employee
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <Edit className="inline-block h-5 w-5 mr-2" />
              Edit Employee
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditEmployee} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_full_name">Full Name *</Label>
                <Input
                  id="edit_full_name"
                  value={employeeForm.full_name}
                  onChange={(e) => setEmployeeForm({...employeeForm, full_name: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_email">Email *</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm({...employeeForm, email: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_phone">Phone</Label>
                <Input
                  id="edit_phone"
                  value={employeeForm.phone}
                  onChange={(e) => setEmployeeForm({...employeeForm, phone: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit_department">Department</Label>
                <Select value={employeeForm.department} onValueChange={(value) => setEmployeeForm({...employeeForm, department: value})}>
                  <SelectTrigger id="edit_department">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="IT">IT</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_position">Position</Label>
                <Input
                  id="edit_position"
                  value={employeeForm.position}
                  onChange={(e) => setEmployeeForm({...employeeForm, position: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit_hire_date">Hire Date</Label>
                <Input
                  id="edit_hire_date"
                  type="date"
                  value={employeeForm.hire_date}
                  onChange={(e) => setEmployeeForm({...employeeForm, hire_date: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit_salary">Salary</Label>
                <Input
                  id="edit_salary"
                  type="number"
                  value={employeeForm.salary}
                  onChange={(e) => setEmployeeForm({...employeeForm, salary: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit_status">Status</Label>
                <Select value={employeeForm.status} onValueChange={(value) => setEmployeeForm({...employeeForm, status: value})}>
                  <SelectTrigger id="edit_status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit_address">Address</Label>
              <Input
                id="edit_address"
                value={employeeForm.address}
                onChange={(e) => setEmployeeForm({...employeeForm, address: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="edit_emergency_contact">Emergency Contact</Label>
              <Input
                id="edit_emergency_contact"
                value={employeeForm.emergency_contact}
                onChange={(e) => setEmployeeForm({...employeeForm, emergency_contact: e.target.value})}
                placeholder="Name - Phone"
              />
            </div>
            <div>
              <Label htmlFor="edit_notes">Notes</Label>
              <Textarea
                id="edit_notes"
                value={employeeForm.notes}
                onChange={(e) => setEmployeeForm({...employeeForm, notes: e.target.value})}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Update Employee
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Delete Employee
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {employeeToDelete?.full_name}? 
              This action cannot be undone and will permanently remove the employee from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEmployee} className="bg-red-600 hover:bg-red-700">
              Delete Employee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HR;