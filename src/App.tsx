import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import CRMLayout from "./components/layout/CRMLayout";
import Dashboard from "./pages/Dashboard";
import DealsPage from "./pages/DealsPage";
import ClientsPage from "./pages/ClientsPage";
import ExposPage from "./pages/ExposPage";
import FinancePage from "./pages/FinancePage";
import BoothsPage from "./pages/BoothsPage";
import TasksPage from "./pages/TasksPage";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/crm" element={<CRMLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="expos" element={<ExposPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="booths" element={<BoothsPage />} />
            <Route path="deals" element={<DealsPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route index element={<Dashboard />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
