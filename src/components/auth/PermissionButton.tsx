import React from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import {useAuth} from '@/contexts/AuthContext';

interface PermissionButtonProps extends ButtonProps {
  permission?: string;
  role?: string;
}

export const CreateButton: React.FC<PermissionButtonProps> = ({
  children,
  permission,
  role,
  ...props
}) => {
  // For now, we'll just return a regular button
  // In a real implementation, you would check user permissions here
  const {can,hasRole}=useAuth();
  if(permission?!can(permission):role&&!hasRole(role))return null;
  return <Button {...props}>{children}</Button>;
};

export const EditButton: React.FC<PermissionButtonProps> = ({
  children,
  permission,
  role,
  ...props
}) => {
  // For now, we'll just return a regular button
  // In a real implementation, you would check user permissions here
  const {can,hasRole}=useAuth();
  if(permission?!can(permission):role&&!hasRole(role))return null;
  return <Button {...props}>{children}</Button>;
};

export const DeleteButton: React.FC<PermissionButtonProps> = ({
  children,
  permission,
  role,
  ...props
}) => {
  // For now, we'll just return a regular button
  // In a real implementation, you would check user permissions here
  const {can,hasRole}=useAuth();
  if(permission?!can(permission):role&&!hasRole(role))return null;
  return <Button {...props}>{children}</Button>;
};
