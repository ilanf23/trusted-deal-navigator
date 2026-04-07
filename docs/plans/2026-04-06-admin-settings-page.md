# Admin Settings Page

## Overview

Create a comprehensive settings page accessible from every admin profile (both /superadmin/settings and /admin/settings). The page will consolidate account management, profile editing, appearance controls (theme toggle relocated here), and additional SaaS productivity tools into a single organized hub.

## Context

- Files involved:
  - Create: `src/pages/admin/Settings.tsx` (main settings page)
  - Create: `src/components/admin/settings/ProfileSection.tsx` (profile editing)
  - Create: `src/components/admin/settings/SecuritySection.tsx` (password/email changes)
  - Create: `src/components/admin/settings/AppearanceSection.tsx` (theme toggle)
  - Create: `src/components/admin/settings/NotificationSection.tsx` (notification preferences)
  - Create: `src/components/admin/settings/SessionSection.tsx` (active sessions)
  - Create: `src/components/admin/settings/KeyboardShortcutsSection.tsx` (shortcuts reference)
  - Modify: `src/App.tsx` (add settings routes)
  - Modify: `src/components/admin/AdminSidebar.tsx` (add settings nav item)
  - Modify: `src/contexts/AuthContext.tsx` (add updateUser helper if needed)
- Related patterns: Partner Profile page (`src/pages/partner/Profile.tsx`), AvatarUpload component, SceneThemeToggle, PartnerLayout theme toggle, useTeamMember hook
- Dependencies: next-themes (already installed), Supabase auth.updateUser() API, existing `avatars` storage bucket

## Development Approach

- **Testing approach**: Regular (code first, then manual verification via dev server)
- No automated test suite exists in this project; verification will be manual via dev server
- Follow existing admin portal patterns: shadcn/ui components, Tailwind styling, admin-portal color scheme
- Reuse existing AvatarUpload component for profile photo management
- Use Supabase auth.updateUser() for email/password changes
- Complete each task fully before moving to the next

## Implementation Steps

### Task 1: Create Settings Page Shell and Routing

**Files:**
- Create: `src/pages/admin/Settings.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/admin/AdminSidebar.tsx`

- [x] Create `src/pages/admin/Settings.tsx` with a tabbed/sectioned layout using shadcn Card and Tabs components. Sections: Profile, Security, Appearance, Notifications, Keyboard Shortcuts, Sessions. Use a left sidebar navigation within the page for section switching.
- [x] Add `/admin/settings` and `/superadmin/settings` routes in `src/App.tsx`, both pointing to the Settings page component, wrapped in appropriate route guards
- [x] Add a "Settings" nav item with a gear icon (Settings from lucide-react) to AdminSidebar.tsx in both the owner and employee navigation sections. Place it near the bottom of the nav, above the user profile footer area.

### Task 2: Profile Section - View and Edit Profile Information

**Files:**
- Create: `src/components/admin/settings/ProfileSection.tsx`
- Modify: `src/pages/admin/Settings.tsx`

- [ ] Build ProfileSection component with editable fields: display name, email (read-only here, editable in Security), phone number, position/title, and address fields (city, state, zip)
- [ ] Integrate existing AvatarUpload component for profile photo management with crop/zoom functionality
- [ ] Use React Hook Form + Zod for form validation
- [ ] Save profile changes to the `users` table via Supabase update, with toast notifications for success/error
- [ ] Invalidate team-member query cache on successful save

### Task 3: Security Section - Email and Password Changes

**Files:**
- Create: `src/components/admin/settings/SecuritySection.tsx`
- Modify: `src/pages/admin/Settings.tsx`

- [ ] Build SecuritySection with two subsections: Change Email and Change Password
- [ ] Change Email: input for new email, calls `supabase.auth.updateUser({ email: newEmail })`. Show notice that a confirmation email will be sent to both old and new addresses.
- [ ] Change Password: current password verification field, new password field, confirm password field. Use `supabase.auth.updateUser({ password: newPassword })`. Add password strength indicator (min 8 chars, mixed case, number, special char).
- [ ] Add proper error handling and success toast notifications for both flows
- [ ] Show last password change date if available from user metadata

### Task 4: Appearance Section - Theme Toggle

**Files:**
- Create: `src/components/admin/settings/AppearanceSection.tsx`
- Modify: `src/pages/admin/Settings.tsx`

- [ ] Build AppearanceSection using `useTheme()` from next-themes
- [ ] Include three theme options: Light, Dark, System (follows OS preference). Use radio cards or toggle group with visual previews (sun icon, moon icon, monitor icon).
- [ ] Show the SceneThemeToggle as a visual preview element alongside the radio selection
- [ ] Ensure theme change applies immediately across the entire admin portal without page reload

### Task 5: Notification Preferences Section

**Files:**
- Create: `src/components/admin/settings/NotificationSection.tsx`
- Modify: `src/pages/admin/Settings.tsx`

- [ ] Build NotificationSection with toggle switches for notification categories: Email notifications (new leads, task assignments, deal updates, system alerts), Browser push notification preferences, Daily digest email on/off
- [ ] Store preferences in the `users` table using a JSONB column or in user metadata via Supabase auth. If no existing column fits, store in Supabase auth user_metadata for now.
- [ ] Load existing preferences on mount and save changes with debounced auto-save or explicit save button

### Task 6: Keyboard Shortcuts and Sessions Sections

**Files:**
- Create: `src/components/admin/settings/KeyboardShortcutsSection.tsx`
- Create: `src/components/admin/settings/SessionSection.tsx`
- Modify: `src/pages/admin/Settings.tsx`

- [ ] Build KeyboardShortcutsSection as a reference card showing useful keyboard shortcuts for the app (navigation shortcuts, common actions). Display in a clean grid/table layout.
- [ ] Build SessionSection showing the current active session info: browser, IP approximation (from Supabase session), login time, and a sign-out-all-devices button using `supabase.auth.signOut({ scope: 'global' })`
- [ ] Include account creation date and last sign-in timestamp from Supabase auth metadata

### Task 7: Polish and Verify

**Files:**
- Modify: `src/pages/admin/Settings.tsx` (final polish)
- Modify: `src/components/admin/settings/*` (responsive adjustments)

- [ ] Ensure all sections render correctly in both light and dark themes
- [ ] Verify responsive layout works on mobile and tablet breakpoints
- [ ] Test navigation from sidebar to settings page for both super admin and employee roles
- [ ] Verify profile updates persist correctly in the database
- [ ] Verify password and email change flows work end-to-end
- [ ] Verify theme toggle applies globally and persists across page reloads
- [ ] Run `npm run lint` and fix any linting errors
- [ ] Run `npm run build` to verify no build errors

### Task 8: Update documentation

- [ ] Update CLAUDE.md if internal patterns changed (new settings route, new components directory)
- [ ] Move this plan to `docs/plans/completed/`
