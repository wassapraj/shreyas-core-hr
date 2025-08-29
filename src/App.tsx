import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminSetup from "./pages/AdminSetup";
import HRDashboard from '@/pages/HRDashboard';
import HROffers from '@/pages/HROffers';
import CandidateOfferView from '@/pages/CandidateOfferView';
import EmployeeProfile from '@/pages/EmployeeProfile';
import EmployeeLeave from '@/pages/EmployeeLeave';
import HRLeaves from '@/pages/HRLeaves';
import HRAttendance from '@/pages/HRAttendance';
import PayrollRuns from '@/pages/PayrollRuns';
import PayrollItems from '@/pages/PayrollItems';
import HRAssets from '@/pages/HRAssets';
import AssetDetail from '@/pages/AssetDetail';
import EmployeeAssets from '@/pages/EmployeeAssets';
import HRAnnouncements from '@/pages/HRAnnouncements';
import EmployeeAnnouncements from '@/pages/EmployeeAnnouncements';
import HRNotes from '@/pages/HRNotes';
import EmployeeNotes from '@/pages/EmployeeNotes';
import HRReminders from '@/pages/HRReminders';
import EmployeeReminders from '@/pages/EmployeeReminders';
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin-setup" element={<AdminSetup />} />
            <Route path="/offer/:token" element={<CandidateOfferView />} />
            
            {/* HR Routes */}
            <Route 
              path="/hr" 
              element={
                <ProtectedRoute requiredRole="hr">
                  <Layout><HRDashboard /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hr/employees" 
              element={
                <ProtectedRoute requiredRole="hr">
                  <Layout><div>HR Employees (Coming Soon)</div></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hr/attendance" 
              element={
                <ProtectedRoute requiredRole="hr">
                  <Layout><HRAttendance /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hr/leaves" 
              element={
                <ProtectedRoute requiredRole="hr">
                  <Layout><HRLeaves /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hr/payroll" 
              element={
                <ProtectedRoute requiredRole="hr">
                  <Layout><PayrollRuns /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hr/payroll/:runId" 
              element={
                <ProtectedRoute requiredRole="hr">
                  <Layout><PayrollItems /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hr/offers" 
              element={
                <ProtectedRoute requiredRole="hr">
                  <Layout><HROffers /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hr/assets" 
              element={
                <ProtectedRoute requiredRole="hr">
                  <Layout><HRAssets /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hr/assets/:id" 
              element={
                <ProtectedRoute requiredRole="hr">
                  <Layout><AssetDetail /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hr/announcements" 
              element={
                <ProtectedRoute requiredRole="hr">
                  <Layout><HRAnnouncements /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hr/notes" 
              element={
                <ProtectedRoute requiredRole="hr">
                  <Layout><HRNotes /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hr/reminders" 
              element={
                <ProtectedRoute requiredRole="hr">
                  <Layout><HRReminders /></Layout>
                </ProtectedRoute>
              } 
            />
            
            {/* Employee Routes */}
            <Route 
              path="/me" 
              element={
                <ProtectedRoute>
                  <Layout><EmployeeProfile /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/me/leave" 
              element={
                <ProtectedRoute requiredRole="employee">
                  <Layout><EmployeeLeave /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/me/assets" 
              element={
                <ProtectedRoute requiredRole="employee">
                  <Layout><EmployeeAssets /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/me/announcements" 
              element={
                <ProtectedRoute requiredRole="employee">
                  <Layout><EmployeeAnnouncements /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/me/notes" 
              element={
                <ProtectedRoute requiredRole="employee">
                  <Layout><EmployeeNotes /></Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/me/reminders" 
              element={
                <ProtectedRoute requiredRole="employee">
                  <Layout><EmployeeReminders /></Layout>
                </ProtectedRoute>
              } 
            />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;