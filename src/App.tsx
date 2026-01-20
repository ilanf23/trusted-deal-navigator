import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import EmployeeRoute from "@/components/admin/EmployeeRoute";
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
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
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
import LenderPrograms from "./pages/admin/LenderPrograms";
import EvansPage from "./pages/admin/EvansPage";
import EvansLeads from "./pages/admin/EvansLeads";
import EvansPipeline from "./pages/admin/EvansPipeline";
import EvansTasks from "./pages/admin/EvansTasks";
import EvansCalls from "./pages/admin/EvansCalls";
import EvansGmail from "./pages/admin/EvansGmail";
import DevNotes from "./pages/admin/DevNotes";
import MaurasPage from "./pages/admin/MaurasPage";
import WendysPage from "./pages/admin/WendysPage";
import BradsPage from "./pages/admin/BradsPage";
import AdamsPage from "./pages/admin/AdamsPage";
import IlansPage from "./pages/admin/IlansPage";
import BugTesting from "./pages/admin/BugTesting";
import BugReporting from "./pages/admin/BugReporting";
import IlanTeamEvanBugs from "./pages/admin/IlanTeamEvanBugs";
import IlanTeamEvanDevNotes from "./pages/admin/IlanTeamEvanDevNotes";
import CalendarCallback from "./pages/admin/CalendarCallback";
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
            <Route path="/admin" element={<ProtectedRoute requireAdmin><SuperAdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/leads" element={<ProtectedRoute requireAdmin><AdminLeads /></ProtectedRoute>} />
            <Route path="/admin/crm" element={<ProtectedRoute requireAdmin><CRMBoard /></ProtectedRoute>} />
            <Route path="/admin/clients" element={<ProtectedRoute requireAdmin><AdminClients /></ProtectedRoute>} />
            <Route path="/admin/contracts" element={<ProtectedRoute requireAdmin><AdminContracts /></ProtectedRoute>} />
            <Route path="/admin/invoices" element={<ProtectedRoute requireAdmin><AdminInvoices /></ProtectedRoute>} />
            <Route path="/admin/messages" element={<ProtectedRoute requireAdmin><AdminMessages /></ProtectedRoute>} />
            <Route path="/admin/bug-reporting" element={<ProtectedRoute requireAdmin><BugReporting /></ProtectedRoute>} />
            <Route path="/admin/marketing" element={<ProtectedRoute requireAdmin><AdminMarketing /></ProtectedRoute>} />
            <Route path="/admin/newsletter" element={<ProtectedRoute requireAdmin><AdminNewsletter /></ProtectedRoute>} />
            <Route path="/admin/rate-watch" element={<ProtectedRoute requireAdmin><AdminRateWatch /></ProtectedRoute>} />
            <Route path="/admin/lender-programs" element={<ProtectedRoute requireAdmin><LenderPrograms /></ProtectedRoute>} />
            {/* Team Member Routes (employees like Evan, Maura, Wendy) */}
            <Route path="/team/evan" element={<EmployeeRoute employeeName="Evan"><EvansPage /></EmployeeRoute>} />
            <Route path="/team/evan/leads" element={<EmployeeRoute employeeName="Evan"><EvansLeads /></EmployeeRoute>} />
            <Route path="/team/evan/pipeline" element={<EmployeeRoute employeeName="Evan"><EvansPipeline /></EmployeeRoute>} />
            <Route path="/team/evan/tasks" element={<EmployeeRoute employeeName="Evan"><EvansTasks /></EmployeeRoute>} />
            <Route path="/team/evan/calls" element={<EmployeeRoute employeeName="Evan"><EvansCalls /></EmployeeRoute>} />
            <Route path="/team/evan/gmail" element={<EmployeeRoute employeeName="Evan"><EvansGmail /></EmployeeRoute>} />
            <Route path="/team/evan/dev-notes" element={<EmployeeRoute employeeName="Evan"><DevNotes /></EmployeeRoute>} />
            <Route path="/team/maura" element={<EmployeeRoute employeeName="Maura"><MaurasPage /></EmployeeRoute>} />
            <Route path="/team/wendy" element={<EmployeeRoute employeeName="Wendy"><WendysPage /></EmployeeRoute>} />
            {/* Founder/Admin Routes (Brad, Adam, Ilan) */}
            <Route path="/admin/brad" element={<EmployeeRoute employeeName="Brad"><BradsPage /></EmployeeRoute>} />
            <Route path="/admin/adam" element={<EmployeeRoute employeeName="Adam"><AdamsPage /></EmployeeRoute>} />
            <Route path="/admin/ilan" element={<EmployeeRoute employeeName="Ilan"><IlansPage /></EmployeeRoute>} />
            <Route path="/admin/ilan/bugs" element={<EmployeeRoute employeeName="Ilan"><BugTesting /></EmployeeRoute>} />
            <Route path="/admin/ilan/team/evan/bugs" element={<EmployeeRoute employeeName="Ilan"><IlanTeamEvanBugs /></EmployeeRoute>} />
            <Route path="/admin/ilan/team/evan/dev-notes" element={<EmployeeRoute employeeName="Ilan"><IlanTeamEvanDevNotes /></EmployeeRoute>} />
            <Route path="/admin/inbox/callback" element={<AdminInboxCallback />} />
            <Route path="/admin/calendar-callback" element={<CalendarCallback />} />
            {/* Client Portal Routes - /user/{name} for clients */}
            <Route path="/user" element={<ProtectedRoute clientOnly><PortalDashboard /></ProtectedRoute>} />
            <Route path="/user/contracts" element={<ProtectedRoute clientOnly><PortalContracts /></ProtectedRoute>} />
            <Route path="/user/invoices" element={<ProtectedRoute clientOnly><PortalInvoices /></ProtectedRoute>} />
            <Route path="/user/messages" element={<ProtectedRoute clientOnly><PortalMessages /></ProtectedRoute>} />
            <Route path="/user/profile" element={<ProtectedRoute clientOnly><PortalProfile /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
