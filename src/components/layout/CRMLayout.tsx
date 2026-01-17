import React from 'react';
import { Outlet } from 'react-router-dom';
import { Layout } from './Layout';

export default function CRMLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}