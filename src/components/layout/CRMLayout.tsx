import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Calendar, 
  Store, 
  Gift, 
  TrendingUp, 
  CreditCard, 
  Percent, 
  FileText, 
  CheckSquare, 
  MessageSquare, 
  BarChart3, 
  Bell, 
  Settings,
  Search,
  Menu,
  X,
  User,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: number;
  children?: SidebarItem[];
}

const sidebarItems: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: BarChart3,
    path: '/crm/dashboard'
  },
  {
    id: 'expos',
    label: 'Expo Management',
    icon: Calendar,
    path: '/crm/expos'
  },
  {
    id: 'clients',
    label: 'Client Management',
    icon: Users,
    path: '/crm/clients'
  },
  {
    id: 'booths',
    label: 'Booth Management',
    icon: Store,
    path: '/crm/booths'
  },
  {
    id: 'sponsorships',
    label: 'Sponsorship Packages',
    icon: Gift,
    path: '/crm/sponsorships'
  },
  {
    id: 'deals',
    label: 'Deals Pipeline',
    icon: TrendingUp,
    path: '/crm/deals',
    badge: 12
  },
  {
    id: 'finance',
    label: 'Finance & Payments',
    icon: CreditCard,
    path: '/crm/finance'
  },
  {
    id: 'commissions',
    label: 'Commissions',
    icon: Percent,
    path: '/crm/commissions'
  },
  {
    id: 'proposals',
    label: 'Proposals & Contracts',
    icon: FileText,
    path: '/crm/proposals'
  },
  {
    id: 'tasks',
    label: 'Tasks & Tickets',
    icon: CheckSquare,
    path: '/crm/tasks',
    badge: 5
  },
  {
    id: 'chat',
    label: 'Internal Chat',
    icon: MessageSquare,
    path: '/crm/chat',
    badge: 3
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    path: '/crm/reports'
  },
  {
    id: 'users',
    label: 'User Management',
    icon: User,
    path: '/crm/users'
  },
  {
    id: 'client-portal',
    label: 'Client Portal',
    icon: Building2,
    path: '/crm/client-portal'
  }
];

export default function CRMLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const currentUser = {
    name: 'John Smith',
    email: 'john.smith@spaceorganizing.com',
    role: 'Sales Manager',
    avatar: null
  };

  const notifications = [
    { id: 1, title: 'Payment Due', message: 'ABC Corp payment due in 2 days', type: 'warning' },
    { id: 2, title: 'Deal Update', message: 'XYZ Deal moved to Terms Finalized', type: 'info' },
    { id: 3, title: 'New Task', message: 'Follow up with Tech Expo client', type: 'info' }
  ];

  const handleSidebarItemClick = (path: string) => {
    navigate(path);
  };

  const isActiveRoute = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="flex h-screen bg-crm-background">
      {/* Sidebar */}
      <div className={cn(
        "crm-sidebar flex flex-col transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-64"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          {!sidebarCollapsed && (
            <div className="flex items-center space-x-2">
              <Building2 className="h-8 w-8 text-crm-accent" />
              <div>
                <h1 className="text-lg font-semibold text-white">SPACE CRM</h1>
                <p className="text-xs text-white/60">Enterprise System</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-white hover:bg-white/10"
          >
            {sidebarCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSidebarItemClick(item.path)}
              className={cn(
                "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActiveRoute(item.path)
                  ? "bg-crm-accent text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <Badge variant="secondary" className="bg-crm-accent/20 text-crm-accent border-0">
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-white/10">
          {!sidebarCollapsed && (
            <div className="flex items-center space-x-3 text-white">
              <div className="w-8 h-8 bg-crm-accent rounded-full flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentUser.name}</p>
                <p className="text-xs text-white/60 truncate">{currentUser.role}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-crm-border px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Global Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-crm-secondary-text" />
                <Input
                  placeholder="Search deals, clients, expos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 crm-input"
                />
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    <Bell className="h-5 w-5" />
                    {notifications.length > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 bg-crm-error text-white text-xs">
                        {notifications.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.map((notification) => (
                    <DropdownMenuItem key={notification.id} className="flex flex-col items-start p-3">
                      <div className="font-medium">{notification.title}</div>
                      <div className="text-sm text-crm-secondary-text">{notification.message}</div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-crm-accent rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-medium">{currentUser.name}</p>
                      <p className="text-xs text-crm-secondary-text">{currentUser.role}</p>
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}