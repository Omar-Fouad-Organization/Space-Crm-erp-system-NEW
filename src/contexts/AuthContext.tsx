import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  roles: string[];
  hasRole: (role: string) => boolean;
  hasPageAccess: (page: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock user data for development
  const mockUser: User = {
    id: '1',
    email: 'admin@space.com',
    name: 'Admin User',
    role: 'super_admin',
    roles: ['super_admin', 'management', 'hr', 'sales', 'user']
  };

  useEffect(() => {
    // Simulate loading user data
    setTimeout(() => {
      setUser(mockUser);
      setLoading(false);
    }, 1000);
  }, []);

  const hasRole = (role: string): boolean => {
    if (!user) return false;
    return user.roles.includes(role);
  };

  const hasPageAccess = (page: string): boolean => {
    if (!user) return false;
    
    // Define page access rules based on roles
    const pageAccessRules: Record<string, string[]> = {
      'dashboard': ['user', 'sales', 'management', 'hr', 'super_admin'],
      'clients': ['user', 'sales', 'management', 'hr', 'super_admin'],
      'deals': ['user', 'sales', 'management', 'hr', 'super_admin'],
      'exhibitions': ['user', 'sales', 'management', 'hr', 'super_admin'],
      'booths': ['user', 'sales', 'management', 'hr', 'super_admin'],
      'payments': ['sales', 'management', 'hr', 'super_admin'],
      'finance': ['management', 'hr', 'super_admin'],
      'tasks': ['user', 'sales', 'management', 'hr', 'super_admin'],
      'user-management': ['hr', 'super_admin'],
      'analytics': ['management', 'hr', 'super_admin'],
      'notifications': ['user', 'sales', 'management', 'hr', 'super_admin'],
      'settings': ['super_admin']
    };

    const allowedRoles = pageAccessRules[page] || [];
    return user.roles.some(role => allowedRoles.includes(role));
  };

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    // Simulate login
    setTimeout(() => {
      setUser(mockUser);
      setLoading(false);
    }, 1000);
  };

  const logout = (): void => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      roles: user?.roles || [],
      hasRole,
      hasPageAccess,
      login,
      logout,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
