# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Vite)
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint
npm run preview      # Preview production build
```

There are no automated tests. Playwright is installed but not actively used.

## Architecture Overview

**CommercialLendingX** is a multi-role commercial lending platform with four distinct portals:
- **Superadmin** (`/superadmin`) — Founders (Ilan, Brad, Adam) with full access
- **Employee** (`/admin/:name`) — Scoped per-employee dashboards (Evan, Maura, Wendy)
- **Client** (`/user`) — Customer portal (contracts, invoices, messages)
- **Partner** (`/partner`) — Referral partner portal

Stack: React 18 + TypeScript + Vite, shadcn/ui + Tailwind, Supabase (auth/db/edge functions), Twilio Voice SDK, TanStack Query.

## Project Structure

```
src/
  components/     # ~270 components across 11 subdirectories
    ui/           # 61 shadcn/ui primitives (do not heavily modify)
    admin/        # 105 admin portal components (CRM, pipeline, inbox, dropbox, sheets)
    evan/         # 25 Evan sales rep portal components (dashboard, gmail, tasks)
    home/         # 10 public landing page sections
    layout/       # 3 public site layout wrappers (Header, Footer, PublicLayout)
    auth/         # ProtectedRoute guard
    ai/           # AI assistant UI (CLXAssistant + chat modes)
    gmail/        # Gmail integration components
    feed/         # Activity feed
    partner/      # Partner portal layout + routing
    portal/       # Client portal layout
  pages/          # 72 page components (admin 41, portal 5, partner 4, public 11, solutions 3)
  hooks/          # 35 custom hooks (pipeline, gmail, dropbox, sheets, dashboards, tasks, AI)
  contexts/       # 8 React contexts (auth, call, AI, draft, UI state, undo, split view, top bar)
  integrations/   # Supabase client + auto-generated DB types (~5000 lines)
  constants/      # App config (team emails, stage labels, pipeline names)
  lib/            # Utilities (cn(), sanitizeHtml, email signatures)
  utils/          # Pipeline stage color configuration
  styles/         # CSS overrides (Filerobot image editor dark theme)
supabase/
  functions/      # 33 Deno edge functions + _shared/ utilities
email-templates/  # HTML email templates (confirm-signup)
```

## Role-Based Access Control

Three roles stored in `user_roles` table: `admin`, `client`, `partner`.

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

Edge functions live in `supabase/functions/`. Each function is a Deno TypeScript module. All use a shared rate limiting pattern via Postgres atomic counters (`enforceRateLimit(req, funcName, limit, window)`). See `supabase/functions/CLAUDE.md` for full catalog.

Key tables: `team_members`, `user_roles`, `leads`, `active_calls`, `call_events`, `communications`, `ai_conversations`, `contracts`, `invoices`, `partner_referrals`, `pipeline_stages`, `pipelines`, `email_threads`.

## Twilio Calling Architecture

**Inbound:** PSTN → `twilio-inbound` edge function → TwiML dials browser client (`clx-admin`) + fallback phone → `CallContext` SDK "incoming" event → `IncomingCallPopup` → user answers.

**Outbound:** `CallContext.makeOutboundCall()` → Device.connect() → `twilio-voice` edge function → TwiML dials phone.

**Fallback:** `twilio-connect-call` REST API redirects live call to browser if SDK is slow.

Token identity: `clx-admin`. 1-hour expiry from `twilio-token` edge function. Device re-registers every 30s.

## Component Conventions

- UI primitives: `src/components/ui/` (shadcn/ui — do not heavily modify)
- Admin-shared: `src/components/admin/` — see its CLAUDE.md for patterns
- Evan-specific: `src/components/evan/`
- `AdminSidebar.tsx` renders different nav sections based on role (via `useMemo` from `teamMember` + `isOwner`)
- Sidebar collapsed state: `state === 'collapsed'` from `useSidebar()`; always handle both expanded and collapsed rendering paths
- Variants via `cva` (class-variance-authority), props extend native HTML attributes, `React.forwardRef` for ref access

## Key Dependencies

- **UI**: Radix UI (20+ packages), Lucide icons, Framer Motion, dnd-kit (drag-and-drop)
- **Data**: TanStack Query, React Hook Form + Zod, Supabase JS
- **Rich Content**: react-filerobot-image-editor, Fortune Sheet, Recharts, Konva
- **Communication**: Twilio Voice SDK, DOMPurify (HTML sanitization)
- **Routing**: react-router-dom v6
