import React from 'react';
import { Outlet } from 'react-router-dom';
import { Layout } from './Layout';
import {useAuth} from '@/contexts/AuthContext';
import {Navigate} from 'react-router-dom';
import {useLocation} from 'react-router-dom';
import {PageErrorBoundary} from './PageErrorBoundary';
import {routePermission} from '@/auth/access';

export default function CRMLayout() {
  const {user,loading,can}=useAuth();
  const location=useLocation();
  if(loading)return <div role="status">Loading…</div>;
  if(!user)return <Navigate to="/login" replace />;
  const required = routePermission(location.pathname);
  if(required && !can(required)) return <Layout><div role="alert" className="crm-card p-6">You do not have access to this page. Ask an administrator to review your permissions.</div></Layout>;
  return (
    <Layout>
      <PageErrorBoundary key={location.pathname}><Outlet /></PageErrorBoundary>
    </Layout>
  );
}
