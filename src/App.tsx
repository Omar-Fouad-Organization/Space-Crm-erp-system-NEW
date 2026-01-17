import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import CRMLayout from "./components/layout/CRMLayout";
import Dashboard from "./pages/Dashboard";
import DealsPage from "./pages/DealsPage";
import DealDetailPage from "./pages/DealDetailPage";
import Clients from "./pages/Clients";
import ClientDetails from "./pages/ClientDetails";
import ExposPage from "./pages/ExposPage";
import FinancePage from "./pages/FinancePage";
import Booths from "./pages/BoothsPage";
import BoothDetail from "./pages/BoothDetail";
import TasksPage from "./pages/TasksPage";
import CommissionsPage from "./pages/CommissionsPage";
import UsersPage from "./pages/UsersPage";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CurrencyProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/crm" element={<CRMLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="expos" element={<ExposPage />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetails />} />
            <Route path="booths" element={<Booths />} />
            <Route path="booths/:boothId" element={<BoothDetail />} />
            <Route path="deals" element={<DealsPage />} />
            <Route path="deals/:id" element={<DealDetailPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="commissions" element={<CommissionsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route index element={<Dashboard />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
    </CurrencyProvider>
  </QueryClientProvider>
);

export default App;
