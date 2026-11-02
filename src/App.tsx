import WorkflowWorkspace from './pages/WorkflowWorkspace';
import {PasswordRecovery} from './components/workspace/AccountSecurity';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { SystemSettingsProvider } from "@/contexts/SystemSettingsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import CRMLayout from "./components/layout/CRMLayout";
import Dashboard from "./pages/Dashboard";
import DealsPage from "./pages/DealsPage";
import DealDetailPage from "./pages/DealDetailPage";
import Clients from "./pages/Clients";
import ClientDetails from "./pages/ClientDetails";
import Expos from "./pages/Expos";
import ExpoDetail from "./pages/ExpoDetail";
import FinancePage from "./pages/FinancePage";
import Booths from "./pages/BoothsPage";
import BoothDetail from "./pages/BoothDetail";
import TasksPage from "./pages/TasksPage";
import CommissionsPage from "./pages/CommissionsPage";
import UsersPage from "./pages/UsersPage";
import Sponsorship from "./pages/Sponsorship";
import Exhibitors from "./pages/Exhibitors";
import Payments from "./pages/Payments";
import ProposalSystem from "./pages/ProposalSystem";
import Meetings from "./pages/Meetings";
import HR from "./pages/HR";
import Documents from "./pages/Documents";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import {ChatPage, AnalyticsPage, AdvancedPage, NotificationsPage, SettingsPage, DiagnosticsPage, DesignPage, DeleteShowcasePage, ProfilePage, SearchPage, HelpPage} from './pages/WorkspacePages';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SystemSettingsProvider>
      <AuthProvider>
        <CurrencyProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
        <Routes>
          <Route path="/reset-password" element={<PasswordRecovery/>}/><Route path="/login" element={<Index />} />
          <Route path="/" element={<CRMLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="expos" element={<Expos />} />
            <Route path="expos/:expoId" element={<ExpoDetail />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetails />} />
            <Route path="booths" element={<Booths />} />
            <Route path="booths/:boothId" element={<BoothDetail />} />
            <Route path="deals" element={<DealsPage />} />
            <Route path="deals/:id" element={<DealDetailPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="commissions" element={<CommissionsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="tickets" element={<TasksPage key="tickets" initialTab="tickets" />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="sponsorship" element={<Sponsorship />} />
            <Route path="exhibitors" element={<Exhibitors />} />
            <Route path="payments" element={<Payments />} />
            <Route path="proposals" element={<ProposalSystem />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="hr" element={<HR />} />
            <Route path="contracts" element={<Documents />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="advanced" element={<AdvancedPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="user-testing" element={<DiagnosticsPage />} />
            <Route path="performance" element={<DiagnosticsPage performance />} />
            <Route path="design" element={<DesignPage />} />
            <Route path="modern-delete" element={<DeleteShowcasePage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="workspace" element={<WorkflowWorkspace/>}/><Route path="help" element={<HelpPage />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
        </CurrencyProvider>
      </AuthProvider>
    </SystemSettingsProvider>
  </QueryClientProvider>
);

export default App;
