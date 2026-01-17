import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  Settings
} from 'lucide-react';
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
    label: 'Exhibitions',
    icon: Calendar,
    path: '/crm/expos'
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: Users,
    path: '/crm/clients'
  },
  {
    id: 'booths',
    label: 'Booths',
    icon: Store,
    path: '/crm/booths'
  },
  {
    id: 'deals',
    label: 'Deals & Pipeline',
    icon: TrendingUp,
    path: '/crm/deals'
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
    id: 'tasks',
    label: 'Tasks & Tickets',
    icon: CheckSquare,
    path: '/crm/tasks'
  },
  {
    id: 'users',
    label: 'User Management',
    icon: Users,
    path: '/crm/users'
  }
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center px-6 py-4 border-b border-gray-200">
        <Building2 className="h-8 w-8 text-blue-600" />
        <span className="ml-2 text-xl font-bold text-gray-900">SPACE CRM</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                active
                  ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className={cn("h-5 w-5 mr-3", active ? "text-blue-700" : "text-gray-400")} />
              {item.label}
              {item.badge && (
                <span className="ml-auto bg-red-100 text-red-600 text-xs font-medium px-2 py-1 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-200">
        <button
          onClick={() => navigate('/crm/settings')}
          className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <Settings className="h-5 w-5 mr-3 text-gray-400" />
          Settings
        </button>
      </div>
    </div>
  );
}
