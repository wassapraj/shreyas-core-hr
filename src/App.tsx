import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';

import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';

import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import AdminSetup from '@/pages/AdminSetup';
import NotFound from '@/pages/NotFound';

import HRDashboard from '@/pages/HRDashboard';
import HREmployees from '@/pages/HREmployees';
import EmployeeProfileDetail from '@/pages/EmployeeProfileDetail';
import EmployeesImport from '@/pages/EmployeesImport';
import EmployeeProfileManagement from '@/pages/EmployeeProfileManagement';
import HRLeaves from '@/pages/HRLeaves';
import HRAttendance from '@/pages/HRAttendance';
import HRAssets from '@/pages/HRAssets';
import AssetHandoverInbox from '@/pages/AssetHandoverInbox';
import AssetDetail from '@/pages/AssetDetail';
import HROffers from '@/pages/HROffers';
import HRAnnouncements from '@/pages/HRAnnouncements';
import HRReminders from '@/pages/HRReminders';
import HRNotes from '@/pages/HRNotes';
import PayrollRuns from '@/pages/PayrollRuns';
import PayrollItems from '@/pages/PayrollItems';
import DataMaintenance from '@/pages/DataMaintenance';

import EmployeeProfile from '@/pages/EmployeeProfile';
import EmployeeAnnouncements from '@/pages/EmployeeAnnouncements';
import EmployeeLeave from '@/pages/EmployeeLeave';
import EmployeeAssets from '@/pages/EmployeeAssets';
import EmployeeReminders from '@/pages/EmployeeReminders';
import EmployeeNotes from '@/pages/EmployeeNotes';
import CandidateOfferView from '@/pages/CandidateOfferView';

function App() {
  return (
    <Router>
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin-setup" element={<AdminSetup />} />
            <Route path="/offer/:id" element={<CandidateOfferView />} />
            
            <Route path="/" element={<Index />} />
            
            <Route path="/me/profile" element={
              <ProtectedRoute>
                <Layout>
                  <EmployeeProfile />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/me" element={
              <ProtectedRoute>
                <Layout>
                  <EmployeeProfile />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/me/announcements" element={
              <ProtectedRoute>
                <Layout>
                  <EmployeeAnnouncements />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/me/leave" element={
              <ProtectedRoute>
                <Layout>
                  <EmployeeLeave />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/me/assets" element={
              <ProtectedRoute>
                <Layout>
                  <EmployeeAssets />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/me/reminders" element={
              <ProtectedRoute>
                <Layout>
                  <EmployeeReminders />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/me/notes" element={
              <ProtectedRoute>
                <Layout>
                  <EmployeeNotes />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <HRDashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/employees" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <HREmployees />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/employees/:id" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <EmployeeProfileDetail />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/employees/import" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <EmployeesImport />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/employees/manage" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <EmployeeProfileManagement />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/leaves" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <HRLeaves />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/attendance" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <HRAttendance />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/assets" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <HRAssets />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/assets/handover-inbox" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <AssetHandoverInbox />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/assets/:id" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <AssetDetail />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/offers" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <HROffers />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/announcements" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <HRAnnouncements />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/reminders" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <HRReminders />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/notes" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <HRNotes />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/payroll" element={
              <ProtectedRoute requiredRole="hr">
                <Layout>
                  <PayrollRuns />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/hr/payroll/items" element={<ProtectedRoute requiredRole="hr"><Layout><PayrollItems /></Layout></ProtectedRoute>} />
            
            <Route path="/hr/tools/bulk-assign" element={<ProtectedRoute requiredRole="hr"><Layout><BulkAssignment /></Layout></ProtectedRoute>} />
            
            <Route path="/hr/admin/data-tools" element={<ProtectedRoute requiredRole="super_admin"><Layout><DataMaintenance /></Layout></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </Router>
  );
}

export default App;
