import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import { AIAssistantProvider } from "@/contexts/AIAssistantContext";
import CLXAssistant from "@/components/ai/CLXAssistant";
import { CallProvider } from "@/contexts/CallContext";
import { IncomingCallPopup } from "@/components/evan/IncomingCallPopup";
import { useEdgeFunctionWarmup } from "@/hooks/useEdgeFunctionWarmup";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import EmployeeRoute from "@/components/admin/EmployeeRoute";
import AdminRouteLayout from "@/components/admin/AdminRouteLayout";
import PublicLayout from "@/components/layout/PublicLayout";
import AdminPortalWrapper from "@/components/admin/AdminPortalWrapper";
import AdminRoute from "@/components/admin/AdminRoute";
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
import Dashboard from "./pages/admin/Dashboard";
import EmployeeLeads from "./pages/admin/EmployeeLeads";
import EmployeePipeline from "./pages/admin/EmployeePipeline";
import Pipeline from "./pages/admin/Pipeline";
import PipelineFeed from "./pages/admin/PipelineFeed";
import Underwriting from "./pages/admin/Underwriting";
import LenderManagement from "./pages/admin/LenderManagement";
import People from "./pages/admin/People";
import Companies from "./pages/admin/Companies";
import Projects from "./pages/admin/Projects";
import UnderwritingExpandedView from "./components/admin/UnderwritingExpandedView";
import PipelineExpandedView from "./components/admin/PipelineExpandedView";
import LenderManagementExpandedView from "./components/admin/LenderManagementExpandedView";
import PeopleExpandedView from "./components/admin/PeopleExpandedView";
import CompanyExpandedView from "./components/admin/CompanyExpandedView";
import ProjectExpandedView from "./components/admin/ProjectExpandedView";
import Tasks from "./pages/admin/Tasks";
import Calls from "./pages/admin/Calls";
import Gmail from "./pages/admin/Gmail";
import EmailTemplates from "./pages/admin/EmailTemplates";
import Calendar from "./pages/admin/Calendar";
import Scorecard from "./pages/admin/Scorecard";
import ScoreSheet from "./pages/admin/ScoreSheet";
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
import DropboxPage from "./pages/admin/Dropbox";
import DropboxCallback from "./pages/admin/DropboxCallback";
import AIChanges from "./pages/admin/AIChanges";
import LoanVolumeLog from "./pages/admin/LoanVolumeLog";
import VolumeLogExpandedView from "./components/admin/VolumeLogExpandedView";
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
            <BrowserRouter>
              <CLXAssistant />
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
                <Route path="/superadmin/pipeline-test" element={<EmployeePipeline />} />
                <Route path="/superadmin/crm" element={<EmployeePipeline />} />
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
                <Route path="/superadmin/volume-log" element={<LoanVolumeLog />} />
                <Route path="/superadmin/volume-log/lead/:leadId" element={<VolumeLogExpandedView />} />
                <Route path="/superadmin/ai-changes" element={<AIChanges />} />
                <Route path="/superadmin/dropbox" element={<DropboxPage />} />
                <Route path="/superadmin/dropbox/callback" element={<DropboxCallback />} />
                <Route path="/superadmin/inbox/callback" element={<AdminInboxCallback />} />
                <Route path="/superadmin/calendar-callback" element={<CalendarCallback />} />
                <Route path="/superadmin/sheets-callback" element={<SheetsCallback />} />

                {/* Founder/Super Admin Personal Routes */}
                <Route path="/superadmin/brad" element={<EmployeeRoute employeeName="Brad"><BradsPage /></EmployeeRoute>} />
                <Route path="/superadmin/adam" element={<EmployeeRoute employeeName="Adam"><AdamsPage /></EmployeeRoute>} />
                <Route path="/superadmin/ilan" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/superadmin/ilan/dev" element={<EmployeeRoute employeeName="Ilan"><TeamPerformance /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/bugs" element={<EmployeeRoute employeeName="Ilan"><BugTesting /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/gmail" element={<EmployeeRoute employeeName="Ilan"><IlansGmail /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/team/evan/bugs" element={<EmployeeRoute employeeName="Ilan"><IlanTeamEvanBugs /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/team/evan/dev-notes" element={<EmployeeRoute employeeName="Ilan"><IlanTeamEvanDevNotes /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/team/evan/notes" element={<EmployeeRoute employeeName="Ilan"><IlanTeamEvanNotes /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/module-tracker" element={<EmployeeRoute employeeName="Ilan"><ModuleTracker /></EmployeeRoute>} />
                <Route path="/superadmin/ilan/users-roles" element={<EmployeeRoute employeeName="Ilan"><UsersAndRoles /></EmployeeRoute>} />
              </Route>
              
              {/* Admin Employee Routes (wrapped with AdminPortalWrapper for persistent call state) */}
              <Route element={<AdminPortalWrapper />}>
                <Route path="/admin/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
                <Route path="/admin/leads" element={<AdminRoute><EmployeeLeads /></AdminRoute>} />
                <Route path="/admin/pipeline" element={<AdminRoute><Pipeline /></AdminRoute>} />
                <Route path="/admin/pipeline/feed" element={<AdminRoute><PipelineFeed /></AdminRoute>} />
                <Route path="/admin/pipeline/underwriting" element={<AdminRoute><Underwriting /></AdminRoute>} />
                <Route path="/admin/pipeline/lender-management" element={<AdminRoute><LenderManagement /></AdminRoute>} />
                <Route path="/admin/pipeline/projects" element={<AdminRoute><Projects /></AdminRoute>} />
                <Route path="/admin/pipeline/projects/expanded-view/:projectId" element={<AdminRoute><ProjectExpandedView /></AdminRoute>} />
                <Route path="/admin/contacts/people" element={<AdminRoute><People /></AdminRoute>} />
                <Route path="/admin/contacts/companies" element={<AdminRoute><Companies /></AdminRoute>} />
                <Route path="/admin/pipeline/underwriting/expanded-view/:leadId" element={<AdminRoute><UnderwritingExpandedView /></AdminRoute>} />
                <Route path="/admin/pipeline/lender-management/expanded-view/:leadId" element={<AdminRoute><LenderManagementExpandedView /></AdminRoute>} />
                <Route path="/admin/pipeline/pipeline/expanded-view/:leadId" element={<AdminRoute><PipelineExpandedView /></AdminRoute>} />
                <Route path="/admin/contacts/people/expanded-view/:personId" element={<AdminRoute><PeopleExpandedView /></AdminRoute>} />
                <Route path="/admin/contacts/companies/expanded-view/:companyId" element={<AdminRoute><CompanyExpandedView /></AdminRoute>} />
                <Route path="/admin/tasks" element={<AdminRoute><Tasks /></AdminRoute>} />
                <Route path="/admin/calls" element={<AdminRoute><Calls /></AdminRoute>} />
                <Route path="/admin/lender-programs" element={<AdminRoute><LenderPrograms /></AdminRoute>} />
                <Route path="/admin/gmail" element={<AdminRoute><Gmail /></AdminRoute>} />
                <Route path="/admin/email-templates" element={<AdminRoute><EmailTemplates /></AdminRoute>} />
                <Route path="/admin/calendar" element={<AdminRoute><Calendar /></AdminRoute>} />
                <Route path="/admin/scorecard" element={<AdminRoute><Scorecard /></AdminRoute>} />
                <Route path="/admin/scorecard/score-sheet" element={<AdminRoute><ScoreSheet /></AdminRoute>} />
                <Route path="/admin/sheets-callback" element={<SheetsCallback />} />
                <Route path="/admin/dev-notes" element={<AdminRoute><DevNotes /></AdminRoute>} />
                <Route path="/admin/bug-reporting" element={<AdminRoute><BugReporting /></AdminRoute>} />
                <Route path="/admin/messages" element={<AdminRoute><AdminMessages /></AdminRoute>} />
                <Route path="/admin/rate-watch" element={<AdminRoute><AdminRateWatch /></AdminRoute>} />
                <Route path="/admin/dropbox" element={<AdminRoute><DropboxPage /></AdminRoute>} />
                <Route path="/admin/dropbox/callback" element={<DropboxCallback />} />
                <Route path="/admin/inbox/callback" element={<AdminInboxCallback />} />
                <Route path="/admin/calendar-callback" element={<CalendarCallback />} />
                <Route path="/admin/pipeline-test" element={<AdminRoute><EmployeePipeline /></AdminRoute>} />
                <Route path="/admin/crm" element={<AdminRoute><EmployeePipeline /></AdminRoute>} />
                <Route path="/admin/clients" element={<AdminRoute><AdminClients /></AdminRoute>} />
                <Route path="/admin/contracts" element={<AdminRoute><AdminContracts /></AdminRoute>} />
                <Route path="/admin/invoices" element={<AdminRoute><AdminInvoices /></AdminRoute>} />
                <Route path="/admin/newsletter" element={<AdminRoute><AdminNewsletter /></AdminRoute>} />
                <Route path="/admin/marketing" element={<AdminRoute><AdminMarketing /></AdminRoute>} />
                <Route path="/admin/tracking" element={<AdminRoute><AdminTracking /></AdminRoute>} />
                {/* Legacy redirects */}
                <Route path="/admin/evan" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/admin/evan/*" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/user/evan" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/user/evan/*" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/team/evan" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/team/evan/*" element={<Navigate to="/admin/dashboard" replace />} />
              </Route>
              
              {/* Other Employee Routes */}
              <Route element={<AdminRouteLayout />}>
                <Route path="/admin/maura" element={<EmployeeRoute employeeName="Maura"><MaurasPage /></EmployeeRoute>} />
                <Route path="/admin/wendy" element={<EmployeeRoute employeeName="Wendy"><WendysPage /></EmployeeRoute>} />
                <Route path="/admin/ilan" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/admin/ilan/dev" element={<EmployeeRoute employeeName="Ilan"><TeamPerformance /></EmployeeRoute>} />
                <Route path="/admin/ilan/bugs" element={<EmployeeRoute employeeName="Ilan"><BugTesting /></EmployeeRoute>} />
                <Route path="/admin/ilan/gmail" element={<EmployeeRoute employeeName="Ilan"><IlansGmail /></EmployeeRoute>} />
                <Route path="/admin/ilan/team/evan/bugs" element={<EmployeeRoute employeeName="Ilan"><IlanTeamEvanBugs /></EmployeeRoute>} />
                <Route path="/admin/ilan/team/evan/dev-notes" element={<EmployeeRoute employeeName="Ilan"><IlanTeamEvanDevNotes /></EmployeeRoute>} />
                <Route path="/admin/ilan/team/evan/notes" element={<EmployeeRoute employeeName="Ilan"><IlanTeamEvanNotes /></EmployeeRoute>} />
                <Route path="/admin/ilan/module-tracker" element={<EmployeeRoute employeeName="Ilan"><ModuleTracker /></EmployeeRoute>} />
                <Route path="/admin/ilan/users-roles" element={<EmployeeRoute employeeName="Ilan"><UsersAndRoles /></EmployeeRoute>} />
              </Route>

              {/* Legacy redirects for old /admin shared pages */}
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

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
