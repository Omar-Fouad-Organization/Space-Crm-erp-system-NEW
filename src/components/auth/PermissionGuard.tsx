import {useAuth} from '@/contexts/AuthContext';
import React from 'react';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: string;
  role?: string;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  role,
  fallback = null
}) => {
  // For now, we'll just return the children
  // In a real implementation, you would check user permissions here
  const {user,hasRole,can}=useAuth();
  if(!user||(permission?!can(permission):role&&!hasRole(role)))return <>{fallback}</>;
  return <>{children}</>;
};
