import React from 'react';
import { Outlet } from 'react-router-dom';
import { Layout } from './Layout';
import {useAuth} from '@/contexts/AuthContext';
import {Navigate} from 'react-router-dom';
import {useLocation} from 'react-router-dom';
import {PageErrorBoundary} from './PageErrorBoundary';

export default function CRMLayout() {
  const {user,loading}=useAuth();
  const location=useLocation();
  if(loading)return <div role="status">Loading…</div>;
  if(!user)return <Navigate to="/login" replace />;
  return (
    <Layout>
      <PageErrorBoundary key={location.pathname}><Outlet /></PageErrorBoundary>
    </Layout>
  );
}
