# Pages

72 page components organized by portal. Each page is a container that composes components and hooks.

## Route Organization

### Public Pages (11 files, root level)
- `Index.tsx` — Homepage: Hero + AudiencePathways + Stats + RecentDeals + Testimonials + CTA
- `Auth.tsx` — Login/Signup with role-based redirect after auth
- `HowItWorks.tsx` — 6-step process flow
- `Contact.tsx` — Contact form with deal type/timing selectors
- `Transactions.tsx` — Deal showcase (hard-coded transaction history)
- `BankServices.tsx` — Service offerings
- `Questionnaire.tsx` — Dynamic lead gen questionnaire (`/questionnaire/:token`)
- `RateWatchQuestionnaire.tsx` — RateWatch lead capture (`/ratewatch/:token`)
- `NotFound.tsx` — 404

### Solutions Pages (3 files, `solutions/`)
- `BusinessAcquisition.tsx`, `CommercialRealEstate.tsx`, `WorkingCapital.tsx`
- All follow: Header + Hero + Product Cards + Case Studies + Footer

### Admin Pages (41 files, `admin/`)
**Core Pipeline:**
- `Pipeline.tsx` — Kanban/table with dnd-kit drag-and-drop, bulk operations
- `Leads.tsx` — Lead list, filtering, creation, LeadDetailDialog
- `Underwriting.tsx`, `LenderManagement.tsx`, `Projects.tsx` — Specialized pipelines with expanded views

**CRM:**
- `People.tsx`, `Companies.tsx`, `Clients.tsx` — Contact management
- `CRMBoard.tsx` — CRM board view

**Communication:**
- `Gmail.tsx`, `IlansGmail.tsx` — Gmail integration
- `Calendar.tsx`, `CalendarCallback.tsx` — Google Calendar
- `Messages.tsx` — Internal messaging
- `Calls.tsx` — Call logging
- `Tasks.tsx` — TaskWorkspace container
- `EmailTemplates.tsx` — Template management

**Analytics:**
- `Dashboard.tsx` — Main dashboard (revenue KPIs, pipeline health, deal sources)
- `SuperAdminDashboard.tsx` — System-wide dashboard
- `TeamPerformance.tsx`, `Scorecard.tsx`, `ScoreSheet.tsx`, `Tracking.tsx`
- `LoanVolumeLog.tsx` — Loan volume with signals

**Integrations:**
- `Dropbox.tsx`, `DropboxCallback.tsx` — Dropbox OAuth + file manager
- `InboxCallback.tsx`, `SheetsCallback.tsx` — OAuth callbacks

**Business Ops:**
- `LenderPrograms.tsx`, `Newsletter.tsx`, `Marketing.tsx`
- `Invoices.tsx`, `Contracts.tsx`, `RateWatch.tsx`

**Admin Tools:**
- `UsersAndRoles.tsx`, `ModuleTracker.tsx`, `AIChanges.tsx`
- `BugReporting.tsx`, `BugTesting.tsx`, `DevNotes.tsx`

**Personal Dashboards:**
- `IlansPage.tsx`, `BradsPage.tsx`, `AdamsPage.tsx`, `MaurasPage.tsx`, `WendysPage.tsx`
- `IlanTeamEvanBugs.tsx`, `IlanTeamEvanDevNotes.tsx`, `IlanTeamEvanNotes.tsx`

### Portal Pages (5 files, `portal/`)
Client-only (`ProtectedRoute` with `clientOnly`), routes at `/user/*`:
- `Dashboard.tsx` — Stats (pending contracts, unpaid invoices, conversations)
- `Contracts.tsx`, `Invoices.tsx`, `Messages.tsx`, `Profile.tsx`

### Partner Pages (4 files, `partner/`)
Routes at `/partner/*`:
- `Dashboard.tsx` — Referral stats, commissions, real-time subscription
- `Referrals.tsx`, `Commissions.tsx`, `Profile.tsx`

## Expanded View Routes
Several list pages have detail routes:
- `/admin/pipeline/underwriting/expanded-view/:leadId`
- `/admin/contacts/people/expanded-view/:personId`
- `/admin/contacts/companies/expanded-view/:companyId`
- `/superadmin/volume-log/lead/:leadId`

## Data Fetching Patterns
- Admin pages use custom hooks (`useDashboardData`, `usePipelineLeads`, etc.)
- Portal/Partner pages use direct Supabase queries
- Partner dashboard uses Supabase real-time for live updates
- Dashboard pages use `EvanUIStateContext` to persist time period selections
