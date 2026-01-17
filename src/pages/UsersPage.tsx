import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2,
  User,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Settings,
  Key,
  UserCheck
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
import { User as UserType, UserRole, AuditLog } from '@/types';
import CreateUserDialog from '@/components/users/CreateUserDialog';
import { format } from 'date-fns';

// Mock data
const mockUsers: (UserType & { last_login?: string })[] = [
  {
    id: '1',
    email: 'admin@spaceorganizing.com',
    full_name: 'John Admin',
    role: 'super_admin',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    last_login: '2024-01-17T08:30:00Z'
  },
  {
    id: '2',
    email: 'sarah.johnson@spaceorganizing.com',
    full_name: 'Sarah Johnson',
    role: 'sales_executive',
    status: 'active',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    last_login: '2024-01-17T09:15:00Z'
  },
  {
    id: '3',
    email: 'mike.rodriguez@spaceorganizing.com',
    full_name: 'Mike Rodriguez',
    role: 'sales_manager',
    status: 'active',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    last_login: '2024-01-17T07:45:00Z'
  },
  {
    id: '4',
    email: 'lisa.chen@spaceorganizing.com',
    full_name: 'Lisa Chen',
    role: 'finance_manager',
    status: 'active',
    created_at: '2024-01-04T00:00:00Z',
    updated_at: '2024-01-17T00:00:00Z',
    last_login: '2024-01-16T16:20:00Z'
  },
  {
    id: '5',
    email: 'david.kim@spaceorganizing.com',
    full_name: 'David Kim',
    role: 'operations',
    status: 'inactive',
    created_at: '2024-01-05T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
    last_login: '2024-01-10T14:30:00Z'
  }
];

const mockAuditLogs: (AuditLog & { user?: { full_name: string } })[] = [
  {
    id: '1',
    user_id: '1',
    action: 'user_created',
    table_name: 'users',
    record_id: '5',
    new_values: { full_name: 'David Kim', role: 'operations' },
    created_at: '2024-01-17T10:30:00Z',
    user: { full_name: 'John Admin' }
  },
  {
    id: '2',
    user_id: '2',
    action: 'deal_status_updated',
    table_name: 'deals',
    record_id: '1',
    old_values: { status: 'meeting' },
    new_values: { status: 'terms_finalized' },
    created_at: '2024-01-17T09:45:00Z',
    user: { full_name: 'Sarah Johnson' }
  },
  {
    id: '3',
    user_id: '3',
    action: 'payment_marked_paid',
    table_name: 'payments',
    record_id: '1',
    old_values: { status: 'pending' },
    new_values: { status: 'paid', paid_date: '2024-01-17' },
    created_at: '2024-01-17T08:15:00Z',
    user: { full_name: 'Mike Rodriguez' }
  }
];

const getRoleColor = (role: UserRole) => {
  const colors = {
    super_admin: 'bg-red-100 text-red-800',
    management: 'bg-purple-100 text-purple-800',
    sales_manager: 'bg-blue-100 text-blue-800',
    sales_executive: 'bg-green-100 text-green-800',
    finance_manager: 'bg-yellow-100 text-yellow-800',
    finance_officer: 'bg-yellow-100 text-yellow-800',
    operations: 'bg-gray-100 text-gray-800',
    support: 'bg-orange-100 text-orange-800',
    client: 'bg-pink-100 text-pink-800'
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
};

const getRoleIcon = (role: UserRole) => {
  switch (role) {
    case 'super_admin':
    case 'management':
      return <Shield className="h-4 w-4" />;
    case 'sales_manager':
    case 'sales_executive':
      return <UserCheck className="h-4 w-4" />;
    case 'finance_manager':
    case 'finance_officer':
      return <Key className="h-4 w-4" />;
    default:
      return <User className="h-4 w-4" />;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'inactive':
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
};

export default function UsersPage() {
  const [users, setUsers] = useState(mockUsers);
  const [auditLogs] = useState(mockAuditLogs);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleCreateUser = (userData: any) => {
    const newUser: UserType = {
      id: Date.now().toString(),
      ...userData,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setUsers([...users, newUser]);
    setShowCreateDialog(false);
  };

  // Calculate user stats
  const userStats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    inactive: users.filter(u => u.status === 'inactive').length,
    admins: users.filter(u => u.role === 'super_admin' || u.role === 'management').length,
    sales_team: users.filter(u => u.role === 'sales_manager' || u.role === 'sales_executive').length,
    recent_logins: users.filter(u => u.last_login && new Date(u.last_login) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length
  };

  const roles: { value: UserRole; label: string }[] = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'management', label: 'Management' },
    { value: 'sales_manager', label: 'Sales Manager' },
    { value: 'sales_executive', label: 'Sales Executive' },
    { value: 'finance_manager', label: 'Finance Manager' },
    { value: 'finance_officer', label: 'Finance Officer' },
    { value: 'operations', label: 'Operations' },
    { value: 'support', label: 'Support' },
    { value: 'client', label: 'Client' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-crm-primary-text">User Management</h1>
          <p className="text-crm-secondary-text">Manage system users, roles, and permissions</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="crm-button-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Total Users</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{userStats.total}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Active</p>
            <p className="text-2xl font-semibold text-green-600 font-tabular">{userStats.active}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Inactive</p>
            <p className="text-2xl font-semibold text-red-600 font-tabular">{userStats.inactive}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Admins</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{userStats.admins}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Sales Team</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{userStats.sales_team}</p>
          </CardContent>
        </Card>
        <Card className="crm-card">
          <CardContent className="p-4 text-center">
            <p className="text-sm font-medium text-crm-secondary-text">Recent Logins</p>
            <p className="text-2xl font-semibold text-crm-primary-text font-tabular">{userStats.recent_logins}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">Users ({userStats.total})</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* Filters */}
          <Card className="crm-card">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-crm-secondary-text" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="crm-card">
            <CardHeader>
              <CardTitle>System Users</CardTitle>
              <CardDescription>
                {filteredUsers.length} users found
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-crm-accent rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-crm-primary-text">{user.full_name}</p>
                            <p className="text-sm text-crm-secondary-text">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getRoleIcon(user.role)}
                          <Badge className={getRoleColor(user.role)}>
                            {user.role.replace('_', ' ')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(user.status)}
                          <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                            {user.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.last_login ? (
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4 text-crm-secondary-text" />
                            <span className="text-sm">
                              {format(new Date(user.last_login), 'MMM dd, HH:mm')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-crm-secondary-text">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {format(new Date(user.created_at), 'MMM dd, yyyy')}
                        </span>
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
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Settings className="mr-2 h-4 w-4" />
                              Manage Permissions
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.status === 'active' ? (
                              <DropdownMenuItem>
                                <XCircle className="mr-2 h-4 w-4" />
                                Deactivate User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Activate User
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
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

        <TabsContent value="audit" className="space-y-6">
          <Card className="crm-card">
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                System activity and user actions log
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="border border-crm-border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="outline" className="capitalize">
                            {log.action.replace('_', ' ')}
                          </Badge>
                          <span className="text-sm text-crm-secondary-text">
                            on {log.table_name}
                          </span>
                        </div>
                        <p className="text-sm text-crm-primary-text mb-2">
                          <span className="font-medium">{log.user?.full_name}</span> performed action on record {log.record_id}
                        </p>
                        {log.old_values && (
                          <div className="text-xs text-crm-secondary-text">
                            <span className="font-medium">Before:</span> {JSON.stringify(log.old_values)}
                          </div>
                        )}
                        {log.new_values && (
                          <div className="text-xs text-crm-secondary-text">
                            <span className="font-medium">After:</span> {JSON.stringify(log.new_values)}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-crm-secondary-text">
                          {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <Card className="crm-card">
            <CardHeader>
              <CardTitle>Role-Based Permissions</CardTitle>
              <CardDescription>
                Configure permissions for different user roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {roles.map((role) => (
                  <div key={role.value} className="border border-crm-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        {getRoleIcon(role.value)}
                        <h3 className="font-medium text-crm-primary-text">{role.label}</h3>
                        <Badge className={getRoleColor(role.value)}>
                          {users.filter(u => u.role === role.value).length} users
                        </Badge>
                      </div>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div className="text-crm-secondary-text">• View Dashboard</div>
                      <div className="text-crm-secondary-text">• Manage Clients</div>
                      <div className="text-crm-secondary-text">• Create Deals</div>
                      <div className="text-crm-secondary-text">• View Reports</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateUser}
      />
    </div>
  );
}