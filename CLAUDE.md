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

Six React contexts in `src/contexts/`:
- `AuthContext` — user, session, role, sign-in/out
- `CallContext` — **entire Twilio call lifecycle** (device init, incoming/outbound calls, mute, duration, health). Initialized eagerly for Evan. Provides `IncomingCallPopup` state.
- `AIAssistantContext` — AI chat conversations (persisted to DB)
- `DraftContext` — unsaved message drafts across navigation
- `EvanUIStateContext` — per-page UI state (filters, view modes) using string keys; survives route changes
- `UndoContext` — reversible operations

`CallContext` is mounted at the App level so the Twilio Device persists globally. **Do not move it inside Evan's route tree.**

## Supabase

Client: `src/integrations/supabase/client.ts`
DB types (auto-generated, ~3700 lines): `src/integrations/supabase/types.ts`

Edge functions live in `supabase/functions/`. Each function is a Deno TypeScript module. All use a shared rate limiting pattern via Postgres atomic counters (`enforceRateLimit(req, funcName, limit, window)`).

Key tables: `team_members`, `user_roles`, `leads`, `active_calls`, `call_events`, `evan_communications`, `ai_conversations`, `contracts`, `invoices`, `partner_referrals`.

## Twilio Calling Architecture

**Inbound:** PSTN → `twilio-inbound` edge function generates TwiML → dials browser client (`clx-admin`) + fallback phone simultaneously → `CallContext` receives SDK "incoming" event → `IncomingCallPopup` shown → user answers.

**Outbound:** `CallContext.makeOutboundCall()` → Twilio Device.connect() → `twilio-voice` edge function generates TwiML → dials phone number.

**Fallback:** If SDK is slow to deliver the call, `twilio-connect-call` REST API redirects the live call to the browser client.

Token identity is hardcoded as `clx-admin`. Tokens fetched from `twilio-token` edge function (requires admin role, 1-hour expiry). Device re-registers every 30s to stay warm.

## Component Conventions

- UI primitives: `src/components/ui/` (shadcn/ui — do not heavily modify these)
- Admin-shared components: `src/components/admin/`
- Evan-specific: `src/components/evan/`
- `AdminSidebar.tsx` renders different nav sections based on role: Ilan-specific, owner, or employee (built via `useMemo` from `teamMember` + `isOwner`)
- Sidebar collapsed state: `state === 'collapsed'` from `useSidebar()`; always handle both expanded and collapsed rendering paths
