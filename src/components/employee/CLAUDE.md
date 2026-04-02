# Evan Components

25 components for Evan's sales rep portal — a specialized admin experience.

## Structure

### Layout (2 files)
- `EvanLayout.tsx` — wraps `AdminLayout`, adds Evan-specific floating UI and context
- `EvanPortalWrapper.tsx` — lifts EvanLayout above route tree to persist Twilio call state

### Widgets (8 files)
Self-contained dashboard cards with own data fetching:
- `EvanMetricsWidget` — KPIs and performance stats
- `EvanCommunicationsWidget` — recent calls, emails, SMS
- `EvanLeadsWidget` — assigned lead pipeline
- `EvanNotesWidget` — personal notes
- `EvanTasksWidget` — task overview
- `EvanCalendarWidget` — upcoming calendar events

### Call UI (4 files)
- `IncomingCallPopup` — shown when Twilio SDK receives inbound call
- `OutboundCallCard` — UI for active outbound calls
- `CallHealthIndicator` — device/socket health status
- `LenderProgramCard` — lender program display

### Subdirectories

**`dashboard/`** (12 files) — Advanced dashboard:
- `TopActions`, `QuickActions` — action buttons
- `TodaysPriorities`, `NudgesWidget` — daily focus
- `PerformanceSnapshot`, `RoadTo1Point5M`, `CommissionTracker` — performance
- `PersonalPipeline`, `HotDeals` — deal tracking
- `ActivityFeed`, `TaskBoard` — activity
- `CompanyRevenueHero` — revenue overview

**`gmail/`** (6 files) — Evan's Gmail integration:
- `GmailInbox`, `GmailEmailList`, `GmailEmailDetail` — inbox UI
- `GmailCore` — core Gmail wrapper
- `EvanGmailFeatures.ts` — feature configuration
- `gmailHelpers.ts` — helper utilities

**`tasks/`** (9 files) — Task management workspace:
- `TaskWorkspace` — main task container
- `TaskTableView`, `TaskKanbanView`, `TaskCalendarView`, `TaskTimelineView` — multiple views
- `TaskDetailDialog` — task detail/edit modal
- `CompletedTasksSection` — completed task archive
- `BorrowerSearchSelect` — borrower autocomplete
- `types.ts` — shared types (`Task`, `TaskActivity`, `TaskFile`, status/priority/type configs)

## Key Patterns

- EvanLayout wraps AdminLayout — Evan inherits all admin chrome
- `EvanPortalWrapper` must stay above route tree to preserve Twilio Device
- Widgets are self-contained: own React Query hooks, internal state, action dialogs
- `types.ts` in tasks/ is the single source for task-related type definitions and color configs
