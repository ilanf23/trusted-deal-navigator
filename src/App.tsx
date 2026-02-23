import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import { AIAssistantProvider } from "@/contexts/AIAssistantContext";
import FloatingAIChat from "@/components/admin/FloatingAIChat";
import { CallProvider } from "@/contexts/CallContext";
import { IncomingCallPopup } from "@/components/evan/IncomingCallPopup";
import { useEdgeFunctionWarmup } from "@/hooks/useEdgeFunctionWarmup";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import EmployeeRoute from "@/components/admin/EmployeeRoute";
import AdminRouteLayout from "@/components/admin/AdminRouteLayout";
import PublicLayout from "@/components/layout/PublicLayout";
import EvanPortalWrapper from "@/components/evan/EvanPortalWrapper";
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
import RateWatchQuestionnaire from "./pages/RateWatchQuestionnaire";
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
import Pipeline from "./pages/admin/Pipeline";
import PipelineFeed from "./pages/admin/PipelineFeed";
import EvansTasks from "./pages/admin/EvansTasks";
import EvansCalls from "./pages/admin/EvansCalls";
import EvansGmail from "./pages/admin/EvansGmail";
import EvansEmailTemplates from "./pages/admin/EvansEmailTemplates";
import EvansCalendar from "./pages/admin/EvansCalendar";
import EvansScorecard from "./pages/admin/EvansScorecard";
import DevNotes from "./pages/admin/DevNotes";
import ModuleTracker from "./pages/admin/ModuleTracker";
import MaurasPage from "./pages/admin/MaurasPage";
import WendysPage from "./pages/admin/WendysPage";
import BradsPage from "./pages/admin/BradsPage";
import AdamsPage from "./pages/admin/AdamsPage";
import IlansPage from "./pages/admin/IlansPage";
import TeamPerformance from "./pages/admin/TeamPerformance";
import IlansGmail from "./pages/admin/IlansGmail";
import BugTesting from "./pages/admin/BugTesting";
import BugReporting from "./pages/admin/BugReporting";
import IlanTeamEvanBugs from "./pages/admin/IlanTeamEvanBugs";
import IlanTeamEvanDevNotes from "./pages/admin/IlanTeamEvanDevNotes";
import IlanTeamEvanNotes from "./pages/admin/IlanTeamEvanNotes";
import UsersAndRoles from "./pages/admin/UsersAndRoles";
import CalendarCallback from "./pages/admin/CalendarCallback";
import SheetsCallback from "./pages/admin/SheetsCallback";
import PortalDashboard from "./pages/portal/Dashboard";
import PortalContracts from "./pages/portal/Contracts";
import PortalInvoices from "./pages/portal/Invoices";
import PortalMessages from "./pages/portal/Messages";
import PortalProfile from "./pages/portal/Profile";
import PartnerRouteLayout from "./components/partner/PartnerRouteLayout";
import PartnerDashboard from "./pages/partner/Dashboard";
import PartnerReferrals from "./pages/partner/Referrals";
import PartnerCommissions from "./pages/partner/Commissions";
import AdminTracking from "./pages/admin/Tracking";
import PartnerProfilePage from "./pages/partner/Profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2,
    },
  },
});

const AppWarmup = () => {
  useEdgeFunctionWarmup();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <AppWarmup />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AIAssistantProvider>
            <FloatingAIChat />

            <BrowserRouter>
              <CallProvider>
              <Routes>
              <Route path="/" element={<PublicLayout><Index /></PublicLayout>} />
              <Route path="/how-it-works" element={<PublicLayout><HowItWorks /></PublicLayout>} />
              <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
              <Route path="/transactions" element={<PublicLayout><Transactions /></PublicLayout>} />
              <Route path="/bank-services" element={<PublicLayout><BankServices /></PublicLayout>} />
              <Route path="/solutions/business-acquisition" element={<PublicLayout><BusinessAcquisition /></PublicLayout>} />
              <Route path="/solutions/commercial-real-estate" element={<PublicLayout><CommercialRealEstate /></PublicLayout>} />
              <Route path="/solutions/working-capital" element={<PublicLayout><WorkingCapital /></PublicLayout>} />
              <Route path="/auth" element={<PublicLayout><Auth /></PublicLayout>} />
              <Route path="/questionnaire/:token" element={<PublicLayout><Questionnaire /></PublicLayout>} />
              <Route path="/ratewatch/:token" element={<PublicLayout><RateWatchQuestionnaire /></PublicLayout>} />

              {/* Super Admin Routes - persistent layout */}
              <Route element={<AdminRouteLayout />}>
                <Route path="/superadmin" element={<SuperAdminDashboard />} />
                <Route path="/superadmin/team-performance" element={<TeamPerformance />} />
                <Route path="/superadmin/leads" element={<AdminLeads />} />
                <Route path="/superadmin/pipeline" element={<Pipeline />} />
                <Route path="/superadmin/pipeline-test" element={<EvansPipeline />} />
                <Route path="/superadmin/crm" element={<EvansPipeline />} />
                <Route path="/superadmin/clients" element={<AdminClients />} />
                <Route path="/superadmin/contracts" element={<AdminContracts />} />
                <Route path="/superadmin/invoices" element={<AdminInvoices />} />
                <Route path="/superadmin/messages" element={<AdminMessages />} />
                <Route path="/superadmin/bug-reporting" element={<BugReporting />} />
                <Route path="/superadmin/marketing" element={<AdminMarketing />} />
                <Route path="/superadmin/newsletter" element={<AdminNewsletter />} />
                <Route path="/superadmin/rate-watch" element={<AdminRateWatch />} />
                <Route path="/superadmin/lender-programs" element={<LenderPrograms />} />
                <Route path="/superadmin/tracking" element={<AdminTracking />} />
                <Route path="/superadmin/inbox/callback" element={<AdminInboxCallback />} />
                <Route path="/superadmin/calendar-callback" element={<CalendarCallback />} />
                <Route path="/superadmin/sheets-callback" element={<SheetsCallback />} />

                {/* Founder/Super Admin Personal Routes */}
                <Route path="/superadmin/brad" element={<EmployeeRoute employeeName="Brad"><BradsPage /></EmployeeRoute>} />
                <Route path="/superadmin/adam" element={<EmployeeRoute employeeName="Adam"><AdamsPage /></EmployeeRoute>} />
                <Route path="/superadmin/ilan" element={<EmployeeRoute employeeName="Ilan"><IlansPage /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/dev" element={<EmployeeRoute employeeName="Ilan"><TeamPerformance /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/bugs" element={<EmployeeRoute employeeName="Ilan"><BugTesting /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/gmail" element={<EmployeeRoute employeeName="Ilan"><IlansGmail /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/team/evan/bugs" element={<EmployeeRoute employeeName="Ilan"><IlanTeamEvanBugs /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/team/evan/dev-notes" element={<EmployeeRoute employeeName="Ilan"><IlanTeamEvanDevNotes /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/team/evan/notes" element={<EmployeeRoute employeeName="Ilan"><IlanTeamEvanNotes /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/module-tracker" element={<EmployeeRoute employeeName="Ilan"><ModuleTracker /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/users-roles" element={<EmployeeRoute employeeName="Ilan"><UsersAndRoles /></EmployeeRoute>} />
              </Route>
              
              {/* Employee Routes - Evan (wrapped with EvanPortalWrapper for persistent call state) */}
              <Route element={<EvanPortalWrapper />}>
                <Route path="/admin/evan" element={<EmployeeRoute employeeName="Evan"><EvansPage /></EmployeeRoute>} />
                <Route path="/admin/evan/leads" element={<EmployeeRoute employeeName="Evan"><EvansLeads /></EmployeeRoute>} />
                <Route path="/admin/evan/pipeline" element={<EmployeeRoute employeeName="Evan"><Pipeline /></EmployeeRoute>} />
                <Route path="/admin/evan/pipeline/feed" element={<EmployeeRoute employeeName="Evan"><PipelineFeed /></EmployeeRoute>} />
                <Route path="/admin/evan/tasks" element={<EmployeeRoute employeeName="Evan"><EvansTasks /></EmployeeRoute>} />
                <Route path="/admin/evan/calls" element={<EmployeeRoute employeeName="Evan"><EvansCalls /></EmployeeRoute>} />
                <Route path="/admin/evan/lender-programs" element={<EmployeeRoute employeeName="Evan"><LenderPrograms /></EmployeeRoute>} />
                <Route path="/admin/evan/gmail" element={<EmployeeRoute employeeName="Evan"><EvansGmail /></EmployeeRoute>} />
                <Route path="/admin/evan/email-templates" element={<EmployeeRoute employeeName="Evan"><EvansEmailTemplates /></EmployeeRoute>} />
                <Route path="/admin/evan/calendar" element={<EmployeeRoute employeeName="Evan"><EvansCalendar /></EmployeeRoute>} />
                <Route path="/admin/evan/scorecard" element={<EmployeeRoute employeeName="Evan"><EvansScorecard /></EmployeeRoute>} />
                <Route path="/admin/evan/dev-notes" element={<EmployeeRoute employeeName="Evan"><DevNotes /></EmployeeRoute>} />
                <Route path="/admin/evan/bug-reporting" element={<EmployeeRoute employeeName="Evan"><BugReporting /></EmployeeRoute>} />
                <Route path="/admin/evan/messages" element={<EmployeeRoute employeeName="Evan"><AdminMessages /></EmployeeRoute>} />
                <Route path="/admin/evan/rate-watch" element={<EmployeeRoute employeeName="Evan"><AdminRateWatch /></EmployeeRoute>} />
                {/* Legacy /user/evan and /team/evan routes for backward compatibility */}
                <Route path="/user/evan" element={<Navigate to="/admin/evan" replace />} />
                <Route path="/user/evan/*" element={<Navigate to="/admin/evan" replace />} />
                <Route path="/team/evan" element={<Navigate to="/admin/evan" replace />} />
                <Route path="/team/evan/*" element={<Navigate to="/admin/evan" replace />} />
              </Route>
              
              {/* Other Employee Routes */}
              <Route element={<AdminRouteLayout />}>
                <Route path="/admin/maura" element={<EmployeeRoute employeeName="Maura"><MaurasPage /></EmployeeRoute>} />
                <Route path="/admin/wendy" element={<EmployeeRoute employeeName="Wendy"><WendysPage /></EmployeeRoute>} />
              </Route>

              {/* Legacy redirects for old /admin/* shared pages */}
              <Route path="/admin" element={<Navigate to="/superadmin" replace />} />

              {/* Partner Portal Routes */}
              <Route element={<PartnerRouteLayout />}>
                <Route path="/partner" element={<Navigate to="/partner/dashboard" replace />} />
                <Route path="/partner/dashboard" element={<PartnerDashboard />} />
                <Route path="/partner/referrals" element={<PartnerReferrals />} />
                <Route path="/partner/tracking" element={<Navigate to="/partner/dashboard" replace />} />
                <Route path="/partner/commissions" element={<PartnerCommissions />} />
                <Route path="/partner/profile" element={<PartnerProfilePage />} />
              </Route>
              {/* Client Portal Routes */}
              <Route path="/user" element={<ProtectedRoute clientOnly><PortalDashboard /></ProtectedRoute>} />
              <Route path="/user/contracts" element={<ProtectedRoute clientOnly><PortalContracts /></ProtectedRoute>} />
              <Route path="/user/invoices" element={<ProtectedRoute clientOnly><PortalInvoices /></ProtectedRoute>} />
              <Route path="/user/messages" element={<ProtectedRoute clientOnly><PortalMessages /></ProtectedRoute>} />
              <Route path="/user/profile" element={<ProtectedRoute clientOnly><PortalProfile /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
              </Routes>
              <IncomingCallPopup />
              </CallProvider>
            </BrowserRouter>
          </AIAssistantProvider>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
