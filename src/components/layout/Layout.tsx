import {api} from '@/crm/api';
import {toast} from '@/hooks/use-toast';
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Settings,
  HelpCircle,
  Plus,
  X,
  BellRing,
  Eye,
  CheckCircle2,
  Archive,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sidebar } from './Sidebar';
import { UserMenu } from '@/components/auth/UserMenu';
import { useSystemSettings } from '@/contexts/SystemSettingsContext';
import DevelopmentBanner from '@/components/DevelopmentBanner';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(()=>setSidebarOpen(false),[location.pathname,location.search]);
  const { companyName, isMaintenanceMode } = useSystemSettings();

  useEffect(()=>{let active=true;const load=async()=>{try{const r=await api<{data:any[]}>('notifications');if(!active)return;setNotifications(r.data.map(n=>({...n,id:String(n.id),title:n.name,message:n.resource?String(n.resource).replaceAll('_',' '):'',priority:'Normal',status:n.read_at?'Read':'Unread',related_entity:({clients:'client',deals:'deal'} as Record<string,string>)[n.resource],entity_id:n.record_id})));setUnreadCount(r.data.filter(n=>!n.read_at).length);}catch(error){console.error('Notifications unavailable',error);}};void load();const updated=()=>void load();window.addEventListener('crm-record-saved',updated);window.addEventListener('crm-notifications-changed',updated);const timer=setInterval(updated,30000);return()=>{active=false;clearInterval(timer);window.removeEventListener('crm-record-saved',updated);window.removeEventListener('crm-notifications-changed',updated);};},[]);
  const markAsRead=async(id:string)=>{try{await api('notifications/'+id,'PATCH');setNotifications(rows=>rows.map(n=>n.id===id?{...n,status:'Read'}:n));setUnreadCount(count=>Math.max(0,count-(notifications.find(n=>n.id===id)?.status==='Unread'?1:0)));window.dispatchEvent(new Event('crm-notifications-changed'));}catch(error){toast({title:'Notification not updated',description:(error as Error).message,variant:'destructive'});}};
  const markAllAsRead=async()=>{try{await api('notifications/read-all','PATCH');window.dispatchEvent(new Event('crm-notifications-changed'));}catch(error){toast({title:'Notifications not updated',description:(error as Error).message,variant:'destructive'});}};

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'text-red-600';
      case 'Medium': return 'text-yellow-600';
      case 'Low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const recentNotifications = notifications
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="lg:pl-72">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="sm"
                aria-label="Open navigation" aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-slate-100 transition-colors"
              >
                <Search className="h-5 w-5 text-slate-600" />
              </Button>

              {/* Search Bar */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  className="pl-10 pr-4 py-2.5 w-80 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm placeholder-slate-400"
                  type="search" name="workspace-search" autoComplete="off" aria-label="Search workspace"
                  placeholder="Search clients, deals, booths..."
                  onKeyDown={e=>{if(e.key==='Enter'&&e.currentTarget.value.trim())navigate('/search?q='+encodeURIComponent(e.currentTarget.value.trim()));}}
                />
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-2">
              {/* Quick Create */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm border-0 px-4 py-2 rounded-lg transition-all duration-200"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Quick Create</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate('/clients?create=1')}>
                    New Client
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/deals?create=1')}>
                    New Deal
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/booths?create=1')}>
                    New Booth
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/tasks?create=1')}>
                    New Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Action buttons */}
              <Button
                aria-label="Help"
                onClick={()=>navigate('/help')}
                variant="ghost"
                size="sm"
                className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label="Notifications"
                    variant="ghost"
                    size="sm"
                    className="relative p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                  >
                    {unreadCount > 0 ? (
                      <BellRing className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
                        <span className="text-xs font-medium">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-96 shadow-xl border-0 bg-white/95 backdrop-blur-md">
                  <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <span className="font-semibold text-slate-800">Notifications</span>
                    <div className="flex items-center space-x-2">
                      {unreadCount > 0 && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                          {unreadCount} unread
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/notifications')}
                        className="h-6 px-2 text-xs text-slate-600 hover:text-slate-800"
                      >
                        View All
                      </Button>
                    </div>

                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {recentNotifications.length > 0 ? (
                    <>
                      {recentNotifications.map((notification: any) => (
                        <DropdownMenuItem
                          key={notification.id}
                          className="p-3 cursor-pointer hover:bg-gray-50"
                          onClick={() => {
                            markAsRead(notification.id);
                            if (notification.related_entity === 'client' && notification.entity_id) {
                              navigate(`/clients/${notification.entity_id}`);
                            } else if (notification.related_entity === 'deal' && notification.entity_id) {
                              navigate(`/deals/${notification.entity_id}`);
                            } else {
                              navigate('/notifications');
                            }
                          }}
                        >
                          <div className="space-y-1">

                            <div className="flex items-start justify-between">

                              <h4 className="text-sm font-medium text-gray-900 line-clamp-1">
                                {notification.title}
                              </h4>

                              <div className="flex items-center space-x-1 ml-2">

                                {notification.status === 'Unread' && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>

                                )}
                                <Badge variant="outline" className={`text-xs ${getPriorityColor(notification.priority)}`}>
                                  {notification.priority}
                                </Badge>
                              </div>

                            </div>

                            <p className="text-xs text-gray-600 line-clamp-2">
                              {notification.message}
                            </p>

                            <div className="flex items-center justify-between text-xs text-gray-500">

                              <span>
                                {formatDateTime(notification.created_at)}
                              </span>
                              {notification.entity_name && (
                                <span className="font-medium">
                                  {notification.entity_name}
                                </span>
                              )}
                            </div>

                          </div>

                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />

                      <div className="p-2 flex space-x-2">

                        {unreadCount > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={markAllAsRead}
                            className="flex-1 h-8 text-xs"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Mark All Read
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/notifications')}
                          className="flex-1 h-8 text-xs"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View All
                        </Button>
                      </div>

                    </>
                  ) : (
                    <div className="p-4 text-center text-gray-500">

                      <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm font-medium">
                        No notifications
                      </p>
                      <p className="text-xs">
                        You're all caught up!
                      </p>
                    </div>

                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="ghost"
                size="sm"
                className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                onClick={() => navigate('/settings')}
                aria-label="System settings"
              >
                <Settings className="h-4 w-4" />
              </Button>

              {/* User Menu */}
              <div className="flex items-center ml-2">
                <UserMenu />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <DevelopmentBanner />
            <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="p-6">
                {children}
              </div>
            </div>
          </div>
        </main>

      </div>

    </div>

  );
}
