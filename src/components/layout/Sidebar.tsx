import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Briefcase,
  CreditCard,
  DollarSign,
  Percent,
  FileText,
  SquareCheckBig,
  Ticket,
  MessageSquare,
  ChartColumn,
  Brain,
  Bell,
  Settings,
  TestTube,
  Gauge,
  Palette,
  LogOut,
  User,
  Users,
  Calendar,
  ChevronRight,
  Shield,
  Crown,
  Globe
} from 'lucide-react';

const menuSections = [
  {
    title: 'Core Operations',
    items: [
      { name: 'Dashboard', path: '/', icon: ChartColumn, description: 'Executive overview', page: 'dashboard' },
      { name: 'Clients', path: '/clients', icon: User, description: 'Client management', page: 'clients' },
      { name: 'Deals', path: '/deals', icon: Briefcase, description: 'Sales pipeline', page: 'deals' },
      { name: 'Expos', path: '/expos', icon: Briefcase, description: 'Event management', page: 'exhibitions' },
    ]
  },
  {
    title: 'Exhibition',
    items: [
      { name: 'Booths', path: '/booths', icon: Briefcase, description: 'Booth management', page: 'booths' },
      { name: 'Sponsorships', path: '/sponsorship', icon: Crown, description: 'Sponsorship packages', page: 'sponsorship' },
      { name: 'Exhibitors', path: '/exhibitors', icon: Users, description: 'Exhibitor relations', page: 'exhibitors' },
    ]
  },
  {
    title: 'Financial',
    items: [
      { name: 'Payments', path: '/payments', icon: CreditCard, description: 'Transaction tracking', page: 'payments' },
      { name: 'Finance', path: '/finance', icon: DollarSign, description: 'Financial dashboard', page: 'finance' },
      { name: 'Commissions', path: '/commissions', icon: Percent, description: 'Sales compensation', page: 'commissions' },
      { name: 'Proposals', path: '/proposals', icon: FileText, description: 'Client proposals & e-signatures', page: 'proposals' },
    ]
  },
  {
    title: 'Management',
    items: [
      { name: 'Meetings', path: '/meetings', icon: Calendar, description: 'Meeting management', page: 'meetings' },
      { name: 'HR & Team', path: '/hr', icon: Users, description: 'Human resources', page: 'hr', roles: ['super_admin', 'hr', 'management'] },
      { name: 'User Management', path: '/users', icon: Users, description: 'User accounts & roles', page: 'user-management', roles: ['super_admin', 'hr'] },
      { name: 'Contracts', path: '/contracts', icon: FileText, description: 'Legal documents', page: 'contracts' },
      { name: 'Tasks', path: '/tasks', icon: SquareCheckBig, description: 'Operations tasks', page: 'tasks' },
      { name: 'Chat', path: '/chat', icon: MessageSquare, description: 'Team communication', page: 'chat' },
      { name: 'Support', path: '/tickets', icon: Ticket, description: 'Client support', page: 'support' },
    ]
  },
  {
    title: 'Intelligence',
    items: [
      { name: 'Analytics', path: '/analytics', icon: ChartColumn, description: 'Business intelligence', page: 'analytics' },
      { name: 'Advanced Features', path: '/advanced', icon: Brain, description: 'AI-powered CRM features', page: 'advanced', roles: ['super_admin', 'management'] },
      { name: 'Notifications', path: '/notifications', icon: Bell, description: 'Smart alerts', page: 'notifications' },
      { name: 'System', path: '/settings', icon: Settings, description: 'Configuration', page: 'settings', roles: ['super_admin'] },
    ]
  },
  {
    title: 'Quality Assurance',
    items: [
      { name: 'User Testing', path: '/user-testing', icon: TestTube, description: 'API & System diagnostics', page: 'settings', roles: ['super_admin'] },
      { name: 'Performance', path: '/performance', icon: Gauge, description: 'System optimization', page: 'settings', roles: ['super_admin'] },
      { name: 'Design System', path: '/design', icon: Palette, description: 'UI/UX color palette', page: 'settings', roles: ['super_admin'] },
      { name: 'Modern Delete', path: '/modern-delete', icon: TestTube, description: 'Modern delete button showcase', page: 'settings', roles: ['super_admin'] },
    ]
  },
  {
    title: 'Website Management',
    items: [
      { name: 'Website Management', path: '/website', icon: Globe, description: 'Public website CMS', page: 'website-management' },
    ]
  }
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { companyName } = useSystemSettings();
  const { hasPageAccess, hasRole, roles,logout,user } = useAuth();

  const canAccessMenuItem = (item: any) => {
    if (item.page) return hasPageAccess(item.page);
    // Check if user has specific roles required for this item
    if (item.roles && item.roles.length > 0) {
      const hasRequiredRole = item.roles.some((role: string) => hasRole(role));
      if (!hasRequiredRole) return false;
    }
    // Check if user has page access
    if (item.page) {
      return hasPageAccess(item.page);
    }
    return true;
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-2xl">

      {/* Header */}
      <div className="p-6 border-b border-slate-700">

        <div className="flex items-center space-x-3">

          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>

          <div>
            <h1 className="text-lg font-bold text-white">
              {companyName}
            </h1>
            <p className="text-xs text-slate-300">
              CRM & ERP
            </p>
          </div>

        </div>

      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 custom-scrollbar">

        {menuSections.filter(section => section.title !== 'Website Management' || section.items.some(canAccessMenuItem)).map((section) => (
          <div key={section.title}>

            <div className="mb-3">

              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
                {section.title}
              </h3>

            </div>

            <div className="space-y-1">

              {section.items.filter(canAccessMenuItem).map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-all duration-300 group relative transform hover:scale-105 hover:translate-x-1 sidebar-item-glow rounded-lg ${
                      active
                        ? 'bg-gradient-to-r from-slate-700 to-slate-600 text-white shadow-md'
                        : 'text-white hover:bg-gradient-to-r hover:from-slate-700 hover:to-slate-600 hover:text-white hover:shadow-md'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />

                    <div className="flex-1 min-w-0">

                      <div className="text-sm font-medium truncate">
                        {item.name}
                      </div>

                      <div className="text-xs text-slate-300 truncate">
                        {item.description}
                      </div>

                    </div>

                    <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />

                  </button>
                );
              })}
            </div>

          </div>

        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700 space-y-3">

        <div className="flex items-center space-x-3 px-2">

          {/* User Profile */}
          <div className="flex items-center space-x-3 flex-1">

            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                admin
              </div>
              <div className="text-xs text-slate-300 truncate">
                {user?.role}
              </div>
            </div>

          </div>

          {/* Sign Out */}
          <button onClick={()=>void logout()} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>

      </div>

    </div>

  );
}
