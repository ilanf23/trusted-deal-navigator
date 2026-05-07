# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev server (Vite)
npm run build            # Production build
npm run build:dev        # Development build
npm run lint             # ESLint
npm run preview          # Preview production build
npm run generate-schema  # Generate schema.md from Supabase DB (requires DB_PASSWORD in .env)
```

There are no automated tests. Playwright is installed but not actively used.

Large library bundles are split into separate chunks via `vite.config.ts` `manualChunks` (e.g., FullCalendar). Add new entries when introducing large dependencies.

## Architecture Overview

**CommercialLendingX** is a multi-role commercial lending platform with three distinct portals:
- **Superadmin** (`/superadmin`) — Founders (Ilan, Brad, Adam) with full access
- **Employee** (`/admin/:name`) — Scoped per-employee dashboards (Evan, Maura, Wendy)
- **Partner** (`/partner`) — Referral partner portal

Stack: React 18 + TypeScript + Vite, shadcn/ui + Tailwind, Supabase (auth/db/edge functions), Twilio Voice SDK, TanStack Query.

## Project Structure

```
src/
  components/     # ~270 components across 11 subdirectories
    ui/           # 61 shadcn/ui primitives (do not heavily modify)
    admin/        # 105 admin portal components (CRM, pipeline, inbox, dropbox, sheets, settings)
      dashboard/    # Reusable dashboard widgets (CompactKPITile, RevenueComboChart, ActivityHeatmap, PipelineStageBar, useDashboardData)
      pipeline/kanban/  # Shared Kanban board components (KanbanBoard, KanbanColumn, KanbanCardShell, useKanbanDrag)
    employee/     # 31 employee portal components (dashboard, calendar, gmail, tasks)
      calendar/   # Google Calendar-style calendar (FullCalendar engine + custom components)
    home/         # 10 public landing page sections
    layout/       # 3 public site layout wrappers (Header, Footer, PublicLayout)
    auth/         # ProtectedRoute guard
    ai/           # AI assistant UI (CLXAssistant + chat modes)
    gmail/        # Gmail integration components
    feed/         # Activity feed
    partner/      # Partner portal layout + routing
  pages/          # 67 page components (admin 41, partner 4, public 11, solutions 3)
  hooks/          # 40 custom hooks (pipeline, gmail, dropbox, sheets, dashboards, tasks, calendar, AI)
  contexts/       # 8 React contexts (auth, call, AI, draft, UI state, undo, split view, top bar)
  integrations/   # Supabase client + auto-generated DB types (~5000 lines)
  constants/      # App config (team emails, stage labels, pipeline names)
  lib/            # Utilities (cn(), sanitizeHtml, email signatures)
  utils/          # Pipeline stage color configuration
  styles/         # CSS overrides (Filerobot image editor dark theme)
supabase/
  functions/      # Deno edge functions + _shared/ utilities
email-templates/  # HTML email templates (confirm-signup)
```

## Role-Based Access Control

Three roles stored in `users.app_role` column (using `app_role` enum): `admin`, `super_admin`, `partner`.

- **Founders** (Ilan/Brad/Adam): full `/superadmin` + personal dashboards at `/superadmin/:name`
- **Employees**: only their own `/admin/:name` dashboard — enforced by `EmployeeRoute` component
- **Ilan** specifically gets a developer-mode sidebar with extra tools (bug testing, module tracker, users-roles)

The `useTeamMember()` hook is the primary way to get the current user's team info and check `isOwner`. Route guards: `ProtectedRoute` (auth), `EmployeeRoute` (per-employee access).

## Routing

All routes defined in `src/App.tsx`. Key wrappers:
- `AdminRouteLayout` — persistent sidebar for `/superadmin` routes
- `EvanPortalWrapper` — wraps all `/admin/evan` routes; lifts `EvanLayout` to persist Twilio call state across navigation
- `ProtectedRoute` — base auth check with optional `requireAdmin` / `clientOnly` flags

## State Management

Eight React contexts in `src/contexts/` — see `src/contexts/CLAUDE.md` for full details. Critical rule: **`CallContext` is mounted at the App level so the Twilio Device persists globally. Do not move it inside Evan's route tree.**

## Supabase

Client: `src/integrations/supabase/client.ts`
DB types (auto-generated, ~5000 lines): `src/integrations/supabase/types.ts`
Full database schema: `schema.md` — all public tables with columns, types, primary keys, nullable flags, and foreign key relationships. Regenerate with `npm run generate-schema` (requires `DB_PASSWORD` in `.env`).

Edge functions live in `supabase/functions/`. Each function is a Deno TypeScript module. All use a shared rate limiting pattern via Postgres atomic counters (`enforceRateLimit(req, funcName, limit, window)`). See `supabase/functions/CLAUDE.md` for full catalog.

Key tables: `users`, `leads`, `tasks`, `active_calls`, `call_events`, `evan_communications`, `ai_conversations`, `contracts`, `invoices`, `partner_referrals`. The `users` table consolidates former `team_members`, `profiles`, and `people` tables. The `tasks` table is the unified task store (replaces former `lead_tasks`). Task status values are `todo`, `in_progress`, `done`. Assignment uses `team_member_id` (FK to `users`).

Deal pipeline tables (`potential`, `underwriting`, `lender_management`) share two enum columns: `deal_outcome` (open/won/lost/abandoned via `deal_outcome_enum` — tracks win/loss independently of pipeline stage) and `priority` (low/medium/high, nullable `deal_priority` enum).

## Twilio Calling Architecture

**Inbound:** PSTN → `twilio-inbound` edge function → TwiML dials browser client (`clx-admin`) + fallback phone → `CallContext` SDK "incoming" event → `IncomingCallPopup` → user answers.

**Outbound:** `CallContext.makeOutboundCall()` → Device.connect() → `twilio-voice` edge function → TwiML dials phone.

**Fallback:** `twilio-connect-call` REST API redirects live call to browser if SDK is slow.

Token identity: `clx-admin`. 1-hour expiry from `twilio-token` edge function. Device re-registers every 30s.

## Component Conventions

- UI primitives: `src/components/ui/` (shadcn/ui — do not heavily modify these)
- Admin-shared components: `src/components/admin/`
- Employee portal components: `src/components/employee/`
- Settings page at `/superadmin/settings` and `/admin/settings` — consolidated account management, profile editing, appearance (theme toggle), notifications, keyboard shortcuts, and sessions. Components live in `src/components/admin/settings/`.
- `AdminSidebar.tsx` renders different nav sections based on role: Ilan-specific, owner, or employee (built via `useMemo` from `teamMember` + `isOwner`)
- Sidebar collapsed state: `state === 'collapsed'` from `useSidebar()`; always handle both expanded and collapsed rendering paths
- Variants via `cva` (class-variance-authority), props extend native HTML attributes, `React.forwardRef` for ref access
- CRM admin tables: All use native HTML `<table>` (not shadcn Table) with a unified purple theme. Reference implementation: `src/pages/admin/People.tsx`. Key patterns: header bg `#eee6f6`, cell borders `#c8bdd6`, `ResizableColumnHeader` (ColHeader), sticky first column with box shadow, purple selection highlights (`#eee6f6` / `#3b2778`), 13px typography.

## CRITICAL: No Hardcoded Team Member Names

**NEVER hardcode team member names** (e.g., "Evan", "Brad", "Maura") in component names, file names, variable names, default values, or business logic. This rule is non-negotiable.

- **File/component names**: Use generic names like `EmployeeLayout`, `CalendarWidget` — never `EvanLayout`, `EvanCalendarWidget`
- **Default values**: Use `teamMember?.name` from the `useTeamMember()` hook — never `assignee: 'Evan'`
- **Filters/comparisons**: Use team member IDs from the database — never `.find(m => m.name === 'Evan')`
- **Email signatures**: Use `getSignatureHtml(name, email, title)` from `src/lib/email-signature.ts` — never a hardcoded signature constant
- **Route configuration**: Team URL/role maps in `useSuperAdminDashboard.ts` are the only acceptable exception (routing config), and these should eventually come from the DB

If you need team member data, query the `users` table or use the `useTeamMember()` hook. The app must work for any team member without code changes.

## Key Dependencies

- **UI**: Radix UI (20+ packages), Lucide icons, Framer Motion, dnd-kit (drag-and-drop)
- **Data**: TanStack Query, React Hook Form + Zod, Supabase JS
- **Calendar**: FullCalendar 6 (time grid, month, list views with drag-and-drop)
- **Rich Content**: react-filerobot-image-editor, Fortune Sheet, Recharts, Konva
- **Communication**: Twilio Voice SDK, DOMPurify (HTML sanitization)
- **Routing**: react-router-dom v6
