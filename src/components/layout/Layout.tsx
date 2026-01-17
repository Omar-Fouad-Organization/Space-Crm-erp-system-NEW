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
  const { companyName, isMaintenanceMode } = useSystemSettings();

  // Load notifications from localStorage and set up real-time updates
  useEffect(() => {
    const loadNotifications = () => {
      try {
        const storedNotifications = localStorage.getItem('notifications');
        if (storedNotifications) {
          const parsedNotifications = JSON.parse(storedNotifications);
          setNotifications(parsedNotifications);
          const unread = parsedNotifications.filter((n: any) => n.status === 'Unread').length;
          setUnreadCount(unread);
        }
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    };

    // Load initially
    loadNotifications();

    // Set up interval to check for updates
    const interval = setInterval(loadNotifications, 5000); // Check every 5 seconds

    // Listen for storage changes (when notifications are updated from other tabs/components)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'notifications') {
        loadNotifications();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const markAsRead = (notificationId: string) => {
    const updatedNotifications = notifications.map((notification: any) => 
      notification.id === notificationId 
        ? { ...notification, status: 'Read', read_at: new Date().toISOString() }
        : notification
    );
    setNotifications(updatedNotifications);
    localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    const now = new Date().toISOString();
    const updatedNotifications = notifications.map((notification: any) => ({ 
      ...notification, 
      status: 'Read', 
      read_at: notification.read_at || now 
    }));
    setNotifications(updatedNotifications);
    localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    setUnreadCount(0);
  };

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
    <div className="min-h-screen bg-gray-50">

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>

        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">

        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">

          <div className="flex items-center justify-between">

            <div className="flex items-center space-x-4">

              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-black"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
              </Button>
              {/* Search */}
              <div className="relative">

                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Search..." />
              </div>

            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-3">

              {/* Quick Create */}
              <DropdownMenu>

                <DropdownMenuTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Quick Create
                  </Button>
                </DropdownMenuTrigger>

              </DropdownMenu>

              {/* Action buttons */}
              <Button variant="ghost" size="sm">
                <HelpCircle className="h-4 w-4" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative">
                    {unreadCount > 0 ? (
                      <BellRing className="h-4 w-4" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                    {unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">

                        <span className="text-xs font-medium">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      </div>

                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    Notifications
                    <div className="flex items-center space-x-2">

                      {unreadCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {unreadCount} unread
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/notifications')}
                        className="h-6 px-2 text-xs"
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
              
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
              {/* User Menu */}
              <div className="flex items-center">

                <UserMenu />
              </div>

            </div>

          </div>

        </div>

        {/* Page Content */}
        <div className="p-6">

          <DevelopmentBanner />
          {children}
        </div>

      </div>

    </div>

  );
}
