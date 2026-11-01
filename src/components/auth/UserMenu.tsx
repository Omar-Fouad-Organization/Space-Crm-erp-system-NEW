import {useAuth} from '@/contexts/AuthContext';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Settings,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function UserMenu() {
  const navigate = useNavigate();const {user,logout}=useAuth();

  const handleLogout = async () => {await logout();navigate('/login');};

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center space-x-3 px-3 py-2 hover:bg-slate-100 rounded-lg transition-colors">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center shadow-sm">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="hidden md:block text-left">
            <div className="text-sm font-medium text-slate-800">{user?.name}</div>
            <div className="text-xs text-slate-500">{user?.email}</div>
          </div>
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 shadow-xl border-0 bg-white/95 backdrop-blur-md">
        <DropdownMenuLabel className="px-4 py-3 border-b border-slate-100">
          <div className="font-semibold text-slate-800">My Account</div>
          <div className="text-xs text-slate-500 mt-1">Manage your account settings</div>
        </DropdownMenuLabel>
        <div className="py-2">
          <DropdownMenuItem
            onClick={() => navigate('/profile')}
            className="mx-2 rounded-md hover:bg-slate-50 transition-colors"
          >
            <User className="h-4 w-4 mr-3 text-slate-500" />
            <span className="text-slate-700">Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => navigate('/settings')}
            className="mx-2 rounded-md hover:bg-slate-50 transition-colors"
          >
            <Settings className="h-4 w-4 mr-3 text-slate-500" />
            <span className="text-slate-700">Settings</span>
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator className="my-2" />
        <div className="py-2">
          <DropdownMenuItem
            onClick={handleLogout}
            className="mx-2 rounded-md hover:bg-red-50 transition-colors text-red-600 focus:text-red-700"
          >
            <LogOut className="h-4 w-4 mr-3" />
            <span>Log out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}