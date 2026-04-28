# Prompt: Build a Copper-style universal settings portal

## Context

Today the app has a single Settings page at `src/pages/admin/Settings.tsx` with six sections (Profile, Security, Appearance, Notifications, Keyboard Shortcuts, Sessions) rendered in a left-nav-plus-right-card layout. We're replacing it with a **Copper-style universal settings portal** — a single hub where every operator can manage workspace-level configuration AND personal configuration in one place, triggered from a top-level workspace switcher dropdown in the sidebar.

Reference: Copper CRM (copper.com) settings — specifically the Jan 21, 2026 "cleaner settings" redesign. The trigger dropdown is shown in the screenshot Ilan attached. We're replicating the structure, the IA, the labels, and as much of the visual treatment as we can within our existing design system.

## What Copper has (the IA we're replicating)

The dropdown opens from a workspace pill in the top-left corner (the pill shows workspace icon + workspace name + chevron). Inside the dropdown:

```
┌─────────────────────────────────────┐
│ [icon] Commercial Lending X          │  ← workspace name (gray, small)
│   ⚙️  Customization                  │  ← workspace settings (admins only)
│   🎨 Branding & Appearance           │
│   🔌 Integrations                    │
│   ➕ Invite users                    │
│  ─────────────────────────           │
│   ✏️  Edit Navigation                │  ← workspace nav editor (admins only)
│  ─────────────────────────           │
│ [E] Evan                             │  ← user name (gray, small)
│   👤 Profile                         │  ← personal settings (every user)
│   🎚️  Preferences                    │
│   ✉️  Email Settings & Templates     │
│   🔔 Notifications                   │
│  ─────────────────────────           │
│   🎁 Refer a friend & earn           │
│  ─────────────────────────           │
│   ↪️  Log out                        │
└─────────────────────────────────────┘
```

Each menu item routes to a dedicated settings page. The page uses a left-nav structure with the section name highlighted.

## Files to read before changing anything

1. `src/pages/admin/Settings.tsx` — the current Settings page. We're replacing this.
2. `src/components/admin/settings/ProfileSection.tsx` — keep, expand to match Copper's profile fields.
3. `src/components/admin/settings/AppearanceSection.tsx` — repurpose into the user Preferences section.
4. `src/components/admin/settings/NotificationSection.tsx` — keep, expand to match Copper's notification matrix.
5. `src/components/admin/settings/SecuritySection.tsx` — keep but move into Profile (Copper combines password + email under Profile).
6. `src/components/admin/settings/SessionSection.tsx` — keep, move into Profile.
7. `src/components/admin/settings/KeyboardShortcutsSection.tsx` — keep, move into user Preferences.
8. `src/components/admin/AdminSidebar.tsx` — sidebar that needs the workspace switcher pill at the top.
9. `src/components/admin/EmployeeLayout.tsx` (or equivalent layout wrapper) — where the dropdown trigger lives.
10. `src/App.tsx` — routes; we'll add `/superadmin/settings/:section` and `/admin/settings/:section`.
11. `src/integrations/supabase/types.ts` — the `users` table for fields that already exist (avatar_url, timezone, etc.).
12. `src/constants/` — team emails / config constants.
13. `CLAUDE.md` — the rule about no hardcoded team member names. This applies to the workspace switcher (use the `users` table + `useTeamMember()` hook for the user identity).

## Architecture

### 1. Workspace switcher dropdown (the trigger)

**Location:** Top of the sidebar (`AdminSidebar.tsx`), above the nav items. Replaces nothing — it's a new element.

**Visual:**
- Pill button: workspace icon (small avatar with workspace initial) + workspace name (truncated to ~14 chars with ellipsis) + chevron-down icon
- On `bg-[#3b2778]` (the existing CLX purple), white text, rounded-full
- Width: full sidebar minus padding when expanded; collapses to just the icon when sidebar is collapsed
- Opens a `DropdownMenu` (use `@/components/ui/dropdown-menu` shadcn) anchored bottom-start

**Workspace name source:** Hardcoded for now to "Commercial Lending X" — this is the only hardcode allowed because there's only one workspace. Later, this becomes a row in a `workspaces` table.

**Dropdown structure:**

```tsx
<DropdownMenuContent align="start" className="w-72">
  {/* Workspace section header */}
  <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground font-normal text-xs px-2 py-1.5">
    <div className="h-5 w-5 rounded bg-[#eee6f6] flex items-center justify-center">
      <Building2 className="h-3 w-3 text-[#3b2778]" />
    </div>
    Commercial Lending X
  </DropdownMenuLabel>

  {/* Workspace settings — admin-only */}
  {isOwner && (
    <>
      <DropdownMenuItem onClick={() => navigate('/admin/settings/customization')}>
        <Settings className="h-4 w-4 mr-2" /> Customization
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => navigate('/admin/settings/branding')}>
        <Palette className="h-4 w-4 mr-2" /> Branding & Appearance
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => navigate('/admin/settings/integrations')}>
        <Plug className="h-4 w-4 mr-2" /> Integrations
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => navigate('/admin/settings/users')}>
        <UserPlus className="h-4 w-4 mr-2" /> Invite users
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => navigate('/admin/settings/navigation')}>
        <Pencil className="h-4 w-4 mr-2" /> Edit Navigation
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  )}

  {/* User section header */}
  <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground font-normal text-xs px-2 py-1.5">
    <CrmAvatar name={teamMember?.name ?? 'User'} size="sm" />
    {teamMember?.name ?? 'User'}
  </DropdownMenuLabel>

  {/* User settings — every user */}
  <DropdownMenuItem onClick={() => navigate('/admin/settings/profile')}>
    <User className="h-4 w-4 mr-2" /> Profile
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => navigate('/admin/settings/preferences')}>
    <Sliders className="h-4 w-4 mr-2" /> Preferences
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => navigate('/admin/settings/email-templates')}>
    <Mail className="h-4 w-4 mr-2" /> Email Settings & Templates
  </DropdownMenuItem>
  <DropdownMenuItem onClick={() => navigate('/admin/settings/notifications')}>
    <Bell className="h-4 w-4 mr-2" /> Notifications
  </DropdownMenuItem>

  <DropdownMenuSeparator />
  <DropdownMenuItem onClick={() => navigate('/admin/refer')}>
    <Gift className="h-4 w-4 mr-2" /> Refer a friend & earn
  </DropdownMenuItem>

  <DropdownMenuSeparator />
  <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600 focus:bg-red-50">
    <LogOut className="h-4 w-4 mr-2" /> Log out
  </DropdownMenuItem>
</DropdownMenuContent>
```

**Admin gating:** The five workspace items (Customization, Branding & Appearance, Integrations, Invite users, Edit Navigation) only render if `isOwner === true` from `useTeamMember()`. Non-admins see only the user section + Refer + Log out.

### 2. Settings page shell

**Route:** `/admin/settings/:section` and `/superadmin/settings/:section` (delete the old `/settings` route or redirect it to `/settings/profile`).

**File:** Replace `src/pages/admin/Settings.tsx` with a new shell that reads `:section` from the URL and renders the matching section component.

**Layout:**

```tsx
<EmployeeLayout>
  <div className="flex h-[calc(100vh-3.5rem)]">
    {/* Left rail — section nav */}
    <aside className="w-64 border-r border-border bg-card overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Commercial Lending X
        </h2>
        {isOwner && (
          <nav className="space-y-0.5">
            <NavItem to="/admin/settings/customization" icon={Settings} label="Customization" />
            <NavItem to="/admin/settings/branding" icon={Palette} label="Branding & Appearance" />
            <NavItem to="/admin/settings/integrations" icon={Plug} label="Integrations" />
            <NavItem to="/admin/settings/users" icon={UserPlus} label="Invite users" />
            <NavItem to="/admin/settings/navigation" icon={Pencil} label="Edit Navigation" />
          </nav>
        )}

        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-6 mb-3">
          {teamMember?.name ?? 'You'}
        </h2>
        <nav className="space-y-0.5">
          <NavItem to="/admin/settings/profile" icon={User} label="Profile" />
          <NavItem to="/admin/settings/preferences" icon={Sliders} label="Preferences" />
          <NavItem to="/admin/settings/email-templates" icon={Mail} label="Email Settings & Templates" />
          <NavItem to="/admin/settings/notifications" icon={Bell} label="Notifications" />
        </nav>
      </div>
    </aside>

    {/* Right pane — section content */}
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        {/* Render the section based on :section param */}
        {section === 'customization' && <CustomizationSection />}
        {section === 'branding' && <BrandingSection />}
        {section === 'integrations' && <IntegrationsSection />}
        {section === 'users' && <InviteUsersSection />}
        {section === 'navigation' && <EditNavigationSection />}
        {section === 'profile' && <ProfileSection />}
        {section === 'preferences' && <PreferencesSection />}
        {section === 'email-templates' && <EmailTemplatesSection />}
        {section === 'notifications' && <NotificationsSection />}
        {!section && <Navigate to="/admin/settings/profile" replace />}
      </div>
    </main>
  </div>
</EmployeeLayout>
```

`NavItem` is an active-aware NavLink wrapper — when the route matches, apply `bg-[#eee6f6] text-[#3b2778] font-semibold`; otherwise muted with hover.

## The 9 sections — what each must do

For each section, build it under `src/components/admin/settings/[section]/[Section]Section.tsx`. Reuse the existing settings components where they fit; build new ones where they don't.

### A. Customization (admin) — `CustomizationSection.tsx`

**Tabs inside:** Custom Fields | Pipeline Stages | Record Layouts | Activity Types | Tags

**Custom Fields tab:**
- List of all custom fields grouped by entity (People, Companies, Pipelines: Potential / Underwriting / Lender Management, Lender Programs, Tasks)
- "Add Field" button → modal with: Label, Field Key (lowercase, no spaces, auto-generated from label, editable), Type (Text / Number / Date / Dropdown / Multi-select / Checkbox / URL / Email / Phone / Currency), Required toggle, Default value, Visibility (which entities can see it)
- Drag-and-drop reorder within entity groups (use dnd-kit, already a dep — same pattern from #3)
- "Add Section" — collapsible section grouping (e.g. "Contact Details", "Financial Details", "System Info"). Sections are drag-and-drop reorderable.
- Edit / Delete inline on each field row
- Schema: new `custom_fields` table — `id`, `entity_type`, `section_id`, `field_key`, `label`, `field_type`, `options` (jsonb for dropdown), `required`, `default_value`, `position`, `visibility` (jsonb). New `custom_field_sections` table — `id`, `entity_type`, `name`, `position`. Per-record values stored in jsonb column on the entity table OR in a generic `custom_field_values` table — pick the simpler path for the MVP and document the trade-off.

**Pipeline Stages tab:**
- Three sub-cards (Potential, Underwriting, Lender Management) — each shows the stages from `pipeline_stages` table
- Drag-and-drop reorder stages within a pipeline
- Add Stage button → name, color (use the existing color tokens from `src/utils/pipelineStageColors.ts`), win percentage (0-100, optional)
- Edit stage inline (click the name to rename), delete with confirmation if no records are in the stage

**Record Layouts tab:**
- Per-pipeline (Potential, Underwriting, Lender Management): customize which fields appear on the expanded view's left column
- Drag-and-drop reorder, toggle show/hide
- Save persists to `record_layouts` table (`id`, `entity_type`, `pipeline_name`, `field_keys` jsonb array)
- The expanded views need to read from `record_layouts` instead of having a hardcoded field list. **CAVEAT:** This is a significant refactor of the expanded views. If too much scope, ship Custom Fields + Pipeline Stages + Tags first and return to Layouts in v2. Document this decision in a comment.

**Activity Types tab:**
- List of activity types from the existing constants/enum (call, email, meeting, note, todo, follow_up, sms, calendar_event)
- Allow adding custom activity types — name + icon picker (lucide icons) + color
- Persist to `activity_types` table

**Tags tab:**
- Show all distinct tags currently in use across People / Companies / Pipelines
- Allow renaming a tag globally (cascade to all records using it), deleting a tag (with count warning)
- Color assignment per tag

### B. Branding & Appearance (admin) — `BrandingSection.tsx`

**Mirrors Copper's branded navigation feature.** Single-page form, no tabs.

**Sections:**
1. **Logo upload** — drag-drop zone, accepts PNG/SVG, max 2MB, preview at 64x64. On upload, run a quick color-extraction (use a tiny lib like `color-thief` or write a canvas-based pixel sampler) to suggest primary + secondary brand colors. Auto-fill the color pickers below.
2. **Primary color** — color picker (use existing UI patterns; can use `react-colorful` or shadcn equivalent). Default `#3b2778` (current CLX purple). Live preview.
3. **Secondary color** — color picker. Default `#eee6f6`.
4. **Accent color** — color picker. Default Hot Pink-equivalent for primary CTAs.
5. **Theme** — Light / Dark / System (move from current `AppearanceSection.tsx`)
6. **Live preview pane** — on the right side of the form, a mini mockup of the sidebar + a sample button + a sample card — re-renders as colors change

**Persistence:** Insert/update a `workspace_settings` table row (`id`, `logo_url`, `primary_color`, `secondary_color`, `accent_color`, `default_theme`). On save, write CSS variables to `:root` so the entire app re-themes without a reload (use a CSSVariablesProvider context).

**CAVEAT:** Existing components have `bg-[#3b2778]` and `bg-[#eee6f6]` hardcoded throughout. To make branding actually work, those need to migrate to CSS custom properties (e.g. `bg-[var(--brand-primary)]`). That's a larger refactor — for MVP, save the colors and only re-theme the workspace switcher pill + the section nav active state. Document the rest as follow-up.

### C. Integrations (admin) — `IntegrationsSection.tsx`

**Visual:** Card grid (3 columns at desktop, 1 at mobile). Each card shows: integration logo, name, short description, status pill (Connected / Available), Connect/Disconnect button, "Configure" link if connected.

**Integrations to surface (already wired in the app or planned):**

| Integration | Status check | Connect flow |
|---|---|---|
| Gmail | `useGmailConnection()` hook exists | OAuth via existing `/admin/inbox/callback` route |
| Google Calendar | similar Google OAuth | existing `/admin/calendar/callback` |
| Google Drive | OAuth | existing `/admin/dropbox/callback` |
| Twilio Voice | check if `users.twilio_identity` is set | not user-facing — show as "Connected (managed by admin)" |
| Slack | new — show as "Available, coming soon" if no MCP wired | placeholder Connect button |
| Mailchimp | new — placeholder | placeholder |
| DocuSign | new — placeholder | placeholder |
| QuickBooks | new — placeholder | placeholder |
| Zapier | new — placeholder | placeholder |
| Custom webhook | new — Generate Webhook URL + secret | new `webhooks` table |

For the placeholders, render the card with a "Coming soon" pill and disable the Connect button. Don't fake working integrations — be honest about what's wired.

**Configuration sub-page:** Clicking "Configure" on a connected integration opens a per-integration drawer with: account email, last sync time, sync settings (e.g. for Gmail: which labels to sync, two-way sync toggle), Disconnect button.

### D. Invite Users (admin) — `InviteUsersSection.tsx`

**Top of page:** "Invite User" button → modal with: email, name, role (Admin / Member / Read-only), pipelines they have access to (multi-select), "Send invite" button. On submit, insert into `users` table with `app_role` set, send an invite email via the existing `send-invite` edge function (create one if it doesn't exist using the `email-templates/confirm-signup` template).

**Below:** Table of all current users
- Columns: Avatar + name, email, role pill, last active, status (Active / Pending / Disabled), actions (3-dot menu: Make Admin / Revoke Admin / Reset Password / Disable / Remove)
- Search bar at top
- Filter chips: All / Admins / Members / Pending invites
- Use the unified table styling from `src/pages/admin/People.tsx` (purple theme, `#eee6f6` header, 13px typography)

**Workspace-level toggles below the table:**
- "Only Account Owners and Admins can invite new users" (checkbox)
- "New users get Google Sync enabled by default" (checkbox)
- "Default role for new invites" (dropdown: Admin / Member / Read-only)

Persist toggles to `workspace_settings` table.

### E. Edit Navigation (admin) — `EditNavigationSection.tsx`

**Purpose:** Customize what appears in the main left sidebar — reorder items, hide items, group them.

**Layout:**
- Left side: live preview of the sidebar as currently configured
- Right side: list of all available nav items (Dashboard, CRM Board, Pipeline > Potential, Pipeline > Underwriting, Pipeline > Lender Management, People, Companies, Lender Programs, Tasks, Calls, Calendar, Gmail, Dropbox, Sheets, Loan Volume Log, Score Sheet, Marketing, Newsletter, Rate Watch, etc.)
- Drag-and-drop from right to left to add; drag-and-drop within left to reorder; drag off left to remove
- Group headers can be added (e.g. "CRM", "Communications", "Reports")
- Per-role configuration: tabs at top — "Admin / Owner" | "Member" | "Read-only" — each role has its own nav config
- "Reset to default" button per role
- Save button at bottom (sticky)

**Persistence:** New `nav_config` table with `id`, `role`, `items` (jsonb array of `{ label, icon, route, group_id, position }`). The `AdminSidebar.tsx` reads from this table at mount and falls back to the current hardcoded config if no row exists.

**CAVEAT:** Ilan's developer-mode sidebar items (bug testing, module tracker, users-roles) should remain hardcoded for Ilan only — those aren't user-configurable. Add them as a separate "Developer" section that only renders when `teamMember?.email === 'ilan@maverich.ai'`.

### F. Profile (every user) — expand existing `ProfileSection.tsx`

**Sections inside (all on one page, scroll-stacked):**

1. **Photo** — current avatar (CrmAvatar) + "Upload photo" button. Accept JPEG/PNG ≤2MB, recommended 400x400. On upload, write to Supabase Storage `avatars/` bucket and update `users.avatar_url`. (We have this already in `src/components/admin/AvatarUpload.tsx` — reuse.)
2. **Name** — first name, last name, display name (editable text inputs with save-on-blur)
3. **Email** — primary email (read-only — show "Contact admin to change"), recovery email (editable)
4. **Title** — job title text input
5. **Phone** — phone number with format validation
6. **Password** — "Change password" button → modal (move from `SecuritySection.tsx`)
7. **Two-factor authentication** — toggle (move from `SecuritySection.tsx`)
8. **Active sessions** — list of active sessions with device, location, last active, "Sign out" per session (move from `SessionSection.tsx`)
9. **Delete account** — danger-zone red button at bottom → confirmation modal

### G. Preferences (every user) — new `PreferencesSection.tsx`

Roll the existing AppearanceSection + KeyboardShortcutsSection here, plus Copper's preferences fields.

**Sections:**

1. **Display**
   - Theme: Light / Dark / System (radio cards)
   - Density: Comfortable / Compact (radio cards) — affects table row height, card padding
   - Font size: Small / Medium / Large (slider)
2. **Localization**
   - Time zone (searchable dropdown of IANA zones, default to browser-detected)
   - Date format (`MM/DD/YYYY` / `DD/MM/YYYY` / `YYYY-MM-DD`)
   - Time format (12-hour / 24-hour)
   - Currency (USD / EUR / GBP / CAD — dropdown with symbols)
   - Language (English only for v1, but show a "More languages coming soon" disabled state)
   - First day of week (Sunday / Monday)
3. **Default views**
   - Default landing page after login (dropdown of all main routes)
   - Default pipeline view (Board / List)
   - Default Calendar view (Day / Week / Month)
4. **Keyboard shortcuts** — reference list (move from `KeyboardShortcutsSection.tsx`); add "Enable keyboard shortcuts" toggle

**Persistence:** Write to `users.preferences` jsonb column (add the column via migration if it doesn't exist). On change, write to context so it takes effect immediately.

### H. Email Settings & Templates (every user, with admin extras) — new `EmailTemplatesSection.tsx`

**Tabs:** My Templates | Shared Templates (admins only) | Email Signature | Send Settings

**Email Signature tab:**
- Large rich text editor (use existing `RichTextEditor` from `@/components/ui/rich-text-input`)
- "Use Gmail signature instead" toggle — when on, signature pulls from Gmail API at send time
- Live preview pane below the editor showing the signature in a sample email frame
- Default signature uses `getSignatureHtml(name, email, title)` from `@/lib/email-signature.ts`
- Save persists to `users.email_signature` (text column, add via migration if needed)

**My Templates tab:**
- Table of personal templates: Name, Subject preview, Last used, Actions (Edit / Duplicate / Delete)
- "New Template" button → editor: Name, Subject, Body (rich text), Variables (insert `{{first_name}}`, `{{company}}`, `{{deal_value}}` etc. via dropdown)
- Templates persist to `email_templates` table — `id`, `user_id`, `name`, `subject`, `body`, `variables`, `is_shared`, `created_at`
- Templates are accessible from the Gmail compose dialog (`src/components/admin/GmailComposeDialog.tsx`) via a "Templates" dropdown

**Shared Templates tab (admins only):**
- Same UI as My Templates but `is_shared: true`
- Visible to all users in their compose dropdown
- Only admins can edit/delete

**Send Settings tab:**
- Default "From" name override
- Default reply-to address
- BCC self on every send (toggle)
- Track opens (toggle, requires Gmail integration)
- Track clicks (toggle)

### I. Notifications (every user) — expand existing `NotificationSection.tsx`

**Layout:** Matrix table — rows are notification events, columns are channels (In-App / Email / Push). Each cell is a toggle.

**Notification events to include:**

| Category | Event |
|---|---|
| **Tasks** | New task assigned to me |
|  | Task due today |
|  | Task overdue |
|  | Task I created was completed |
| **Deals** | Deal stage changed (in deal I follow) |
|  | Deal value updated (deal I follow) |
|  | Deal marked Won/Lost (deal I follow) |
|  | Deal assigned to me |
|  | New comment on a deal I follow |
| **People & Companies** | New person added to my pipeline |
|  | Person/Company assigned to me |
|  | Tag added to person/company I follow |
| **Email** | New email from a tracked contact |
|  | Email reply received |
|  | Email opened (tracked send) |
| **Calls** | Missed inbound call |
|  | New voicemail |
|  | Call summary ready |
| **Calendar** | Meeting starting in 15 min |
|  | Meeting accepted/declined |
|  | New meeting booked |
| **Mentions & Comments** | I'm mentioned in a comment |
|  | Reply to my comment |
| **System** | New user joined workspace |
|  | Integration disconnected |
|  | Weekly summary digest |

**Per-row controls:** Three toggles (In-App / Email / Push). Push column shows "Enable push" prompt if browser notifications haven't been granted.

**Top of page:**
- "Pause all notifications" toggle with optional duration (1h / 4h / Today / Until I turn back on)
- "Quiet hours" — set a daily window during which non-urgent notifications batch into a digest
- "Email digest" — Daily / Weekly / Off — sends a roll-up of in-app notifications

**Persistence:** `users.notification_preferences` jsonb column with structure `{ event_key: { in_app: bool, email: bool, push: bool } }`. Default all to true on first load.

## Refer a friend & earn

New route `/admin/refer`. Simple page:
- Hero: "Get $100 for every team you refer"
- Personal referral link (auto-generated, copy button)
- Stats: Sent / Signed up / Earned
- Email composer: pre-filled invite text + recipient email field

This is post-MVP polish — ship a placeholder page if needed.

## Log out

Wire to the existing auth signOut from `src/contexts/AuthContext.tsx`. After signOut, redirect to `/login`.

## Routing additions

In `src/App.tsx`, add inside both `/superadmin/*` and `/admin/*` route groups:

```tsx
<Route path="settings" element={<Navigate to="settings/profile" replace />} />
<Route path="settings/:section" element={<Settings />} />
<Route path="refer" element={<ReferAFriend />} />
```

Delete the old single-page Settings route or redirect it.

## Schema migrations needed

Create one migration in `supabase/migrations/` named `*_copper_settings_portal.sql`:

```sql
-- Workspace-level settings (single row for now)
create table if not exists workspace_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_name text default 'Commercial Lending X',
  logo_url text,
  primary_color text default '#3b2778',
  secondary_color text default '#eee6f6',
  accent_color text default '#ec4899',
  default_theme text default 'system',
  invite_admins_only boolean default false,
  default_invite_role text default 'admin',
  default_google_sync boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Custom fields
create table if not exists custom_field_sections (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  name text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

create table if not exists custom_fields (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  section_id uuid references custom_field_sections(id) on delete set null,
  field_key text not null,
  label text not null,
  field_type text not null,
  options jsonb,
  required boolean default false,
  default_value text,
  position int not null default 0,
  visibility jsonb,
  created_at timestamptz default now()
);
create unique index if not exists custom_fields_entity_key_idx on custom_fields(entity_type, field_key);

-- Per-record custom field values
create table if not exists custom_field_values (
  id uuid primary key default gen_random_uuid(),
  custom_field_id uuid not null references custom_fields(id) on delete cascade,
  record_id uuid not null,
  record_type text not null,
  value jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists cfv_record_idx on custom_field_values(record_type, record_id);

-- Per-pipeline record layouts
create table if not exists record_layouts (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  pipeline_name text,
  field_keys jsonb not null,
  created_at timestamptz default now()
);

-- Custom activity types
create table if not exists activity_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null,
  color text not null,
  is_system boolean default false,
  created_at timestamptz default now()
);

-- Per-role nav config
create table if not exists nav_config (
  id uuid primary key default gen_random_uuid(),
  role text not null unique,
  items jsonb not null,
  updated_at timestamptz default now()
);

-- Email templates
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  is_shared boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Webhooks (for the custom integration)
create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  secret text not null,
  events jsonb not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- Add per-user preference columns
alter table users add column if not exists preferences jsonb default '{}'::jsonb;
alter table users add column if not exists notification_preferences jsonb default '{}'::jsonb;
alter table users add column if not exists email_signature text;
alter table users add column if not exists timezone text default 'America/Chicago';
alter table users add column if not exists date_format text default 'MM/DD/YYYY';
alter table users add column if not exists time_format text default '12';
alter table users add column if not exists currency text default 'USD';
alter table users add column if not exists language text default 'en';

-- Seed the default workspace_settings row
insert into workspace_settings (workspace_name) values ('Commercial Lending X')
on conflict do nothing;
```

After the migration, regenerate `src/integrations/supabase/types.ts` via the Supabase CLI.

## Build order (suggested)

1. Migration + type regeneration
2. New Settings page shell + routing + workspace switcher dropdown in sidebar
3. Profile section (expand existing)
4. Preferences section (consolidate Appearance + Shortcuts + new fields)
5. Notifications section (expand the matrix)
6. Email Settings & Templates
7. Invite Users section
8. Branding & Appearance
9. Integrations
10. Customization (biggest — ship Custom Fields + Pipeline Stages + Tags first; defer Record Layouts to v2)
11. Edit Navigation
12. Refer a friend (placeholder)
13. Wire Log out

Ship in PRs of 1-3 sections at a time so each can be reviewed and validated separately.

## Verification checklist

- [ ] Workspace switcher pill appears in the top-left of the sidebar with "Commercial Lending X" + chevron
- [ ] Clicking the pill opens a dropdown matching the screenshot exactly: workspace section header, 4 admin-only items, divider, Edit Navigation, divider, user section header, 4 personal items, divider, Refer, divider, Log out
- [ ] Non-admins (when added later) only see the user section + Refer + Log out — no workspace items
- [ ] Each menu item routes to a working settings page with the correct section highlighted in the left rail
- [ ] Left rail in the settings page mirrors the dropdown structure with workspace/user labels
- [ ] All 9 section pages render content (even if some are MVP placeholders, they must say so explicitly, not blank)
- [ ] Profile shows photo upload, name, email, password change, 2FA, sessions
- [ ] Preferences shows theme, timezone, date format, currency, default views, keyboard shortcuts
- [ ] Notifications shows the matrix table with all event categories and 3 channels per row
- [ ] Email Settings shows signature editor + templates table
- [ ] Invite Users shows table + invite modal + workspace toggles
- [ ] Branding shows logo upload + 3 color pickers + theme + live preview
- [ ] Integrations shows card grid with real status for Gmail/Calendar/Drive and "Coming soon" for the rest
- [ ] Customization shows Custom Fields tab fully working (add/edit/delete/reorder)
- [ ] Edit Navigation shows the drag-drop sidebar editor
- [ ] All saves persist across refresh
- [ ] No hardcoded team member names introduced (per CLAUDE.md rule)
- [ ] Old `/admin/settings` and `/superadmin/settings` routes redirect to `/settings/profile`

## Out of scope (do NOT do)

- Multi-workspace support — there's only ever one workspace ("Commercial Lending X"). The workspace switcher is a dropdown today, not a switcher between workspaces. (Future-proof the data model for multi-workspace by including a `workspace_id` FK on the new tables, but don't build the switcher UI.)
- Migrating every existing `bg-[#3b2778]` to a CSS variable — that's a separate PR after Branding ships
- Mobile push notifications — server-side push setup is its own project; show the toggle but explain "Mobile app coming soon"
- Building the actual integrations for Slack/Mailchimp/DocuSign/QuickBooks — only the cards + placeholder Connect buttons

## Definition of done

A user can open the workspace dropdown from the sidebar, navigate to any of the 9 settings pages, make changes, see them persist on refresh, and the changes propagate where they should (theme switch updates the UI immediately, custom field added shows up on the entity record, new template appears in Gmail compose dropdown, notification toggle change is respected when the next event fires).
