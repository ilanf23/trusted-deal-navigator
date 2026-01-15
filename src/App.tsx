import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import HowItWorks from "./pages/HowItWorks";
import Contact from "./pages/Contact";
import Transactions from "./pages/Transactions";
import BankServices from "./pages/BankServices";
import BusinessAcquisition from "./pages/solutions/BusinessAcquisition";
import CommercialRealEstate from "./pages/solutions/CommercialRealEstate";
import WorkingCapital from "./pages/solutions/WorkingCapital";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Questionnaire from "./pages/Questionnaire";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminLeads from "./pages/admin/Leads";
import AdminClients from "./pages/admin/Clients";
import AdminContracts from "./pages/admin/Contracts";
import AdminInvoices from "./pages/admin/Invoices";
import AdminMessages from "./pages/admin/Messages";
import AdminMarketing from "./pages/admin/Marketing";
import AdminNewsletter from "./pages/admin/Newsletter";
import CRMBoard from "./pages/admin/CRMBoard";
import AdminRateWatch from "./pages/admin/RateWatch";
import AdminInboxCallback from "./pages/admin/InboxCallback";
import PortalDashboard from "./pages/portal/Dashboard";
import PortalContracts from "./pages/portal/Contracts";
import PortalInvoices from "./pages/portal/Invoices";
import PortalMessages from "./pages/portal/Messages";
import PortalProfile from "./pages/portal/Profile";

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
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/bank-services" element={<BankServices />} />
            <Route path="/solutions/business-acquisition" element={<BusinessAcquisition />} />
            <Route path="/solutions/commercial-real-estate" element={<CommercialRealEstate />} />
            <Route path="/solutions/working-capital" element={<WorkingCapital />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/questionnaire/:token" element={<Questionnaire />} />
            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/leads" element={<ProtectedRoute requireAdmin><AdminLeads /></ProtectedRoute>} />
            <Route path="/admin/crm" element={<ProtectedRoute requireAdmin><CRMBoard /></ProtectedRoute>} />
            <Route path="/admin/clients" element={<ProtectedRoute requireAdmin><AdminClients /></ProtectedRoute>} />
            <Route path="/admin/contracts" element={<ProtectedRoute requireAdmin><AdminContracts /></ProtectedRoute>} />
            <Route path="/admin/invoices" element={<ProtectedRoute requireAdmin><AdminInvoices /></ProtectedRoute>} />
            <Route path="/admin/messages" element={<ProtectedRoute requireAdmin><AdminMessages /></ProtectedRoute>} />
            <Route path="/admin/marketing" element={<ProtectedRoute requireAdmin><AdminMarketing /></ProtectedRoute>} />
            <Route path="/admin/newsletter" element={<ProtectedRoute requireAdmin><AdminNewsletter /></ProtectedRoute>} />
            <Route path="/admin/rate-watch" element={<ProtectedRoute requireAdmin><AdminRateWatch /></ProtectedRoute>} />
            <Route path="/admin/inbox/callback" element={<AdminInboxCallback />} />
            {/* Client Portal Routes - clientOnly redirects admins to /admin */}
            <Route path="/portal" element={<ProtectedRoute clientOnly><PortalDashboard /></ProtectedRoute>} />
            <Route path="/portal/contracts" element={<ProtectedRoute clientOnly><PortalContracts /></ProtectedRoute>} />
            <Route path="/portal/invoices" element={<ProtectedRoute clientOnly><PortalInvoices /></ProtectedRoute>} />
            <Route path="/portal/messages" element={<ProtectedRoute clientOnly><PortalMessages /></ProtectedRoute>} />
            <Route path="/portal/profile" element={<ProtectedRoute clientOnly><PortalProfile /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
