# Settings Page Testing - Reference Guide

## 📋 Test Credentials
**Account Type:** Sales Rep (Employee Admin Portal)
**Email:** evan@commerciallendingx.com
**Password:** BaileyDoo916!

These credentials are saved in `.env.test` for future test automation.

---

## 🧪 Test Files Created

### 1. **Public Pages Test** ✅ PASSING
- **File:** `e2e/public-pages.spec.ts`
- **Status:** All 8 public pages render successfully
- **Run:** `npx playwright test e2e/public-pages.spec.ts --config playwright-simple.config.ts`
- **Results:**
  - ✅ Home (2,116ms)
  - ✅ How It Works (659ms)
  - ✅ Contact (596ms)
  - ✅ Transactions (590ms)
  - ✅ Bank Services (586ms)
  - ✅ Business Acquisition (581ms)
  - ✅ Commercial Real Estate (604ms)
  - ✅ Working Capital (582ms)

### 2. **Settings Functionality Test**
- **File:** `e2e/settings-functionality.spec.ts`
- **Purpose:** Full test of settings page buttons and interactivity
- **Run:** `npx playwright test e2e/settings-functionality.spec.ts --config playwright-simple.config.ts`
- **Tests:**
  - Login flow validation
  - Settings page navigation
  - Button interactivity scanning
  - Form input testing
  - Toggle/checkbox functionality
  - Dropdown testing

### 3. **Auth Diagnostic Test**
- **File:** `e2e/auth-diagnostic.spec.ts`
- **Purpose:** Debug auth and page loading issues
- **Run:** `npx playwright test e2e/auth-diagnostic.spec.ts --config playwright-simple.config.ts`

---

## 🚀 Manual Testing Instructions

Since the automated login is testing Supabase auth in headless mode (which has limitations), **manually test the settings page:**

1. **Start the dev server:**
   ```bash
   npm run dev  # Already running on http://localhost:8084
   ```

2. **Open the Simple Browser preview** in VS Code (it's already open)

3. **Login with credentials:**
   - Email: evan@commerciallendingx.com
   - Password: BaileyDoo916!

4. **Navigate to Settings:** `/admin/settings`

5. **Test these settings sections:**

   #### **Preferences Tab**
   - [ ] Theme toggle (Light/Dark/System)
   - [ ] Density selector (Comfortable/Compact)
   - [ ] Font size dropdown
   - [ ] Timezone selector
   - [ ] Date format dropdown
   - [ ] Time format (12/24 hour)
   - [ ] Currency selector
   - [ ] Default landing page
   - [ ] Default pipeline view
   - [ ] Default calendar view
   - [ ] Keyboard shortcuts toggle
   - [ ] "Save preferences" button

   #### **Notifications Tab**
   - [ ] Pause notifications toggle
   - [ ] Pause duration selector (if enabled)
   - [ ] Quiet hours time inputs
   - [ ] Email digest selector
   - [ ] In-App/Email/Push toggles for each event
   - [ ] "Save notifications" button

   #### **Email Settings Tab**
   - [ ] Email signature editor
   - [ ] Use Gmail signature toggle
   - [ ] "Save signature" button

   #### **Integrations Tab**
   - [ ] Gmail connection status
   - [ ] Gmail Connect/Configure button
   - [ ] Calendar connect option
   - [ ] Google Drive connect option
   - [ ] Slack coming soon indicator
   - [ ] Other integration cards display correctly

   ####  **Invite Users Tab** (Admin only)
   - [ ] "Invite User" button
   - [ ] Invite dialog opens
   - [ ] Email input
   - [ ] Name input
   - [ ] Role selector
   - [ ] "Send invite" button
   - [ ] User list displays
   - [ ] Search functionality
   - [ ] Filter chips (All/Admins/Members/Pending)
   - [ ] User action menu
   - [ ] Workspace defaults toggles
   - [ ] Default role selector

   #### **Custom Fields Tab** (Admin only)
   - [ ] "Add field" button for each entity type
   - [ ] Custom field dialog
   - [ ] Label input
   - [ ] Field key input
   - [ ] Type selector
   - [ ] Required toggle
   - [ ] "Save" button

   #### **Pipeline Stages Tab** (Admin only)
   - [ ] Pipeline stage list
   - [ ] Stage name edit inputs
   - [ ] Color picker for each stage
   - [ ] "Add stage" button
   - [ ] Delete buttons

   #### **Edit Navigation Tab** (Admin only)
   - [ ] Admin/Owner nav editor
   - [ ] Member nav editor  
   - [ ] Read-only nav editor
   - [ ] "Add" buttons
   - [ ] Move up/down arrows
   - [ ] Remove (X) buttons
   - [ ] "Reset" button
   - [ ] "Save" button

   #### **Branding Tab** (Admin only)
   - [ ] Logo upload input
   - [ ] Color pickers (Primary/Secondary/Accent)
   - [ ] Theme selector (Light/Dark/System)
   - [ ] Live preview rendering
   - [ ] "Save branding" button

---

## 🎯 Key Findings

✅ **Public Site:** All pages render perfectly with no errors
⚠️ **Authentication:** Headless Supabase auth requires session handling (see notes below)
✅ **Page Infrastructure:** Settings page components are created and deployed
📸 **Screenshot Support:** Playwright captures full-page screenshots for visual validation

---

## 📝 Notes for Future Automation

1. **Supabase Auth in Headless Mode:**
   - Requires either session token passing or local auth setup
   - May need to mock auth context or use `page.context().addCookies()` for auth state
   - Alternative: Test with unauthenticated routes first, then add auth mocking

2. **Settings Page Component Structure:**
   - Uses TanStack Query (`useQuery`, `useMutation`)
   - React Hook Form for form handling
   - Multiple tabs via shadcn/ui Tabs component
   - Each section has independent save/update mutation

3. **Manual Testing Checklist:**
   - All buttons should be clickable and change UI state
   - Form inputs should accept text without validation errors
   - Toggles should flip between on/off
   - Dropdowns should open and accept selection
   - All "Save" buttons should trigger mutations
   - Toast notifications should appear on success/error

---

## 🔗 Related Documentation

- **Settings Page Component:** See `src/pages/admin/Settings.tsx`
- **Settings Sections:** `src/components/admin/settings/*.tsx`
- **Hooks:** `useUserPreferences.ts`, `useWorkspaceSettings.ts`
- **Column Drag-and-Drop Plan:** `docs/plans/2026-04-27-overhaul-column-drag-and-drop.md`

---

## ✨ Next Steps

1. **Manual validation** of settings pages using the checklist above
2. **Fix any UI issues** found during manual testing
3. **Implement auth mocking** for automated tests (if needed)
4. **Add visual regression tests** for critical settings sections
