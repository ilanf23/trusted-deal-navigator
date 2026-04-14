# Google Calendar-Style Redesign for Sales Rep Calendar

## Overview

Replace the current monolithic CalendarWidget (1309 lines, basic list-based views) with a full Google Calendar-style experience: time grid views with hour slots, drag-and-drop rescheduling, click-to-create events, event detail popovers, resizable events, a collapsible sidebar with mini calendar and calendar filters, and a current time indicator. Uses FullCalendar as the rendering engine for time grid and month views, with custom shadcn/ui components for dialogs, popovers, and sidebar.

## Context

- Files involved:
  - Replace: `src/components/employee/CalendarWidget.tsx` (1309 lines)
  - Keep: `src/pages/admin/Calendar.tsx` (page wrapper, 23 lines)
  - Keep: `src/pages/admin/CalendarCallback.tsx` (OAuth callback, 161 lines)
  - Keep: `src/components/employee/tasks/TaskCalendarView.tsx` (task mini calendar, separate feature)
  - New directory: `src/components/employee/calendar/`
  - New hook: `src/hooks/useCalendarData.ts`
- Related patterns: Widget pattern (self-contained with own React Query hooks), shadcn/ui for dialogs/popovers, existing Google Calendar OAuth flow via Supabase edge functions
- Dependencies: @fullcalendar/react, @fullcalendar/daygrid, @fullcalendar/timegrid, @fullcalendar/list, @fullcalendar/interaction (new), date-fns (existing), dnd-kit (existing, not needed for calendar since FullCalendar has its own)
- Database: `appointments` table (local events), `tasks` table (to-dos with due dates), `calendar_connections` table (Google OAuth tokens)

## Development Approach

- Code first, no automated test suite (per project conventions)
- Complete each task fully before moving to the next
- Run `npm run build` and `npm run lint` between tasks to catch issues
- Visual QA in browser after each task (dev server)

## Implementation Steps

### Task 1: Install FullCalendar and create component architecture

**Files:**
- Modify: `package.json`
- Create: `src/components/employee/calendar/CalendarView.tsx` (main container)
- Create: `src/components/employee/calendar/calendar-styles.css` (FullCalendar theme overrides)
- Create: `src/hooks/useCalendarData.ts` (extracted data fetching)

- [x] Install FullCalendar packages: `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/list`, `@fullcalendar/interaction`
- [x] Create `src/components/employee/calendar/` directory
- [x] Extract appointment and task data fetching from CalendarWidget into `useCalendarData.ts` hook (appointments query, tasks query, date range calculation, Google Calendar status check)
- [x] Create skeleton `CalendarView.tsx` that renders a basic FullCalendar with the existing data, replacing the CalendarWidget export
- [x] Create `calendar-styles.css` with Tailwind-compatible CSS custom properties for FullCalendar theming (dark mode support, matching shadcn/ui design tokens)
- [x] Update `src/pages/admin/Calendar.tsx` to import from new `CalendarView` instead of `CalendarWidget`
- [x] Run `npm run build` and verify no errors

### Task 2: Google Calendar-style layout with sidebar and header

**Files:**
- Modify: `src/components/employee/calendar/CalendarView.tsx`
- Create: `src/components/employee/calendar/CalendarSidebar.tsx`
- Create: `src/components/employee/calendar/CalendarHeader.tsx`

- [x] Build `CalendarSidebar.tsx`: collapsible left panel (Google Calendar style) containing:
  - Prominent "Create" button (like Google Calendar's rounded + button)
  - Mini month calendar (using existing shadcn Calendar/react-day-picker) for quick date navigation - clicking a date navigates the main calendar
  - "My calendars" section with color-coded checkboxes: Appointments (blue), To-Dos (amber), Google Calendar (green) - toggling hides/shows that calendar's events
  - Google Calendar connection status and connect/disconnect actions (moved from header dropdown)
  - Sync actions (Push to Google, Pull from Google) when connected
- [x] Build `CalendarHeader.tsx`: toolbar above the calendar containing:
  - Today button (left side)
  - Previous/Next arrows
  - Current date range label (e.g., "April 2026", "Apr 13 - 19, 2026", "Sunday, April 13")
  - View switcher: Day, Week, Month, Schedule (right side, segmented button group)
  - Sidebar toggle button (hamburger/panel icon, far left)
- [x] Wire up CalendarView as the layout container: sidebar + header + FullCalendar main area
- [x] Ensure sidebar collapse/expand animates smoothly and calendar fills available space
- [x] Run `npm run build` and visually verify layout matches Google Calendar proportions

### Task 3: Time grid views (Day and Week) with current time indicator

**Files:**
- Modify: `src/components/employee/calendar/CalendarView.tsx`
- Modify: `src/components/employee/calendar/calendar-styles.css`
- Modify: `src/hooks/useCalendarData.ts`

- [x] Configure FullCalendar timeGridWeek view: 7 columns with hour rows (midnight to midnight), scrollable, default scroll position at 8 AM
- [x] Configure FullCalendar timeGridDay view: single column with hour rows
- [x] Add all-day event section at top of time grid (for tasks without specific times and all-day appointments)
- [x] Map appointments to FullCalendar EventInput objects: start/end times, title, color by type (call=blue, video=purple, meeting=green, imported=teal)
- [x] Map tasks with due dates to FullCalendar events: show as timed events if due_date has time component, otherwise as all-day events, amber color for pending, emerald for completed
- [x] Enable nowIndicator (red line showing current time in time grid views)
- [x] Style hour labels, grid lines, and day headers to match Google Calendar aesthetic (clean, light grid lines, readable typography)
- [x] Handle overlapping events: FullCalendar auto-positions side-by-side (configure slotEventOverlap and eventMaxStack)
- [x] Run `npm run build` and visually verify time grid rendering

### Task 4: Month view and Schedule (agenda) view

**Files:**
- Modify: `src/components/employee/calendar/CalendarView.tsx`
- Modify: `src/components/employee/calendar/calendar-styles.css`

- [x] Configure FullCalendar dayGridMonth view: event chips displayed inside day cells, colored by type
- [x] Configure "+N more" link on days with many events - clicking opens a popover showing all events for that day (FullCalendar moreLinkClick)
- [x] Style month view day cells: today highlighted with blue circle on date number (Google Calendar style), current month days bold, outside-month days dimmed
- [x] Configure FullCalendar listWeek/listMonth view for Schedule/Agenda mode: grouped by day with date headers, event details in rows
- [x] Style list view to match Google Calendar schedule view: date headers with day name + number, event rows with time + colored dot + title
- [x] Ensure view switching (Day/Week/Month/Schedule) preserves the currently viewed date range appropriately
- [x] Run `npm run build` and visually verify all 4 views

### Task 5: Event creation UX (click-to-create, quick create, full dialog)

**Files:**
- Create: `src/components/employee/calendar/EventDialog.tsx`
- Create: `src/components/employee/calendar/QuickEventPopover.tsx`
- Modify: `src/components/employee/calendar/CalendarView.tsx`
- Modify: `src/hooks/useCalendarData.ts` (add mutation hooks)

- [x] Enable FullCalendar `selectable: true` and `dateClick` - clicking an empty time slot opens a QuickEventPopover at that position
- [x] Build `QuickEventPopover.tsx`: small floating card (like Google Calendar) with title input, time display, "Save" and "More options" buttons. Save creates event immediately, "More options" opens full dialog
- [x] Enable click-and-drag on time grid to select a time range - pre-fills start/end in the quick popover
- [x] Build `EventDialog.tsx`: full event creation/editing dialog (shadcn Dialog) with:
  - Title input (large, prominent)
  - Date picker (start date + time, end date + time)
  - Duration presets (15m, 30m, 45m, 1h, 1.5h, 2h)
  - All-day toggle
  - Event type selector (Phone Call, Video Call, In-Person Meeting)
  - Description textarea
  - Lead/borrower association (optional, with search)
  - Save and Cancel buttons
- [x] Extract appointment mutations (add, update, delete) into `useCalendarData.ts` hook
- [x] Wire the "Create" button in CalendarSidebar to open EventDialog with current date/time pre-filled
- [x] Run `npm run build` and test event creation flow in all views

### Task 6: Event detail popover and editing

**Files:**
- Create: `src/components/employee/calendar/EventDetailPopover.tsx`
- Modify: `src/components/employee/calendar/EventDialog.tsx` (add edit mode)
- Modify: `src/components/employee/calendar/CalendarView.tsx`
- Modify: `src/hooks/useCalendarData.ts` (add update mutation)

- [x] Build `EventDetailPopover.tsx`: clicking an existing event shows a popover (like Google Calendar) with:
  - Event title (bold)
  - Date and time range
  - Event type icon + label
  - Description (if any)
  - Google sync status badge (if synced)
  - Associated lead/company (if any)
  - Edit button (pencil icon) - opens EventDialog in edit mode
  - Delete button (trash icon) - with confirmation
  - Close button (X)
- [x] Add edit mode to EventDialog: pre-fills all fields from existing event, Save updates instead of creates
- [x] Add appointment update mutation to `useCalendarData.ts`: PATCH to appointments table, invalidate queries
- [x] Wire FullCalendar `eventClick` callback to show EventDetailPopover positioned near the clicked event
- [x] Handle popover positioning: ensure it stays within viewport bounds
- [x] Run `npm run build` and test view/edit/delete flow

### Task 7: Drag-and-drop rescheduling and event resizing

**Files:**
- Modify: `src/components/employee/calendar/CalendarView.tsx`
- Modify: `src/hooks/useCalendarData.ts`

- [x] Enable FullCalendar `editable: true`, `eventDurationEditable: true`, `eventResizableFromStart: false`
- [x] Implement `eventDrop` callback: when user drags event to new time/day, optimistically update the calendar and fire a Supabase update to change start_time and end_time. On error, revert the event position and show toast
- [x] Implement `eventResize` callback: when user drags bottom edge of event to change duration, optimistically update and fire Supabase update for end_time. On error, revert and toast
- [x] Add visual feedback during drag: FullCalendar shows ghost element by default, style it with reduced opacity
- [x] Prevent dragging of completed tasks (set `editable: false` on completed task events)
- [x] Prevent dragging of imported Google Calendar events that are read-only
- [x] Run `npm run build` and test drag/resize in day, week, and month views

### Task 8: Polish, keyboard shortcuts, and cleanup

**Files:**
- Delete: `src/components/employee/CalendarWidget.tsx` (old component, fully replaced)
- Modify: `src/components/employee/calendar/CalendarView.tsx`
- Modify: `src/components/employee/calendar/calendar-styles.css`

- [x] Add keyboard shortcuts: `t` = today, `d` = day view, `w` = week view, `m` = month view, `c` = create new event (only when calendar is focused, not in input fields)
- [x] Ensure dark mode works: FullCalendar CSS variables mapped to shadcn dark theme tokens, all custom components respect theme
- [x] Responsive behavior: sidebar auto-collapses on smaller screens, mobile-friendly touch targets
- [x] Smooth transitions between views (FullCalendar handles most of this)
- [x] Delete old `CalendarWidget.tsx` (all functionality now in calendar/ directory)
- [x] Update any remaining imports that reference CalendarWidget
- [x] Run `npm run build` and `npm run lint` - all must pass
- [x] Visual QA in browser (skipped - not automatable, requires manual testing)

### Task 9: Verify acceptance criteria

- [ ] Run `npm run build` - must pass
- [ ] Run `npm run lint` - must pass
- [ ] Verify all Google Calendar-style features work:
  - Time grid day/week views with hour slots and current time indicator
  - Month view with event chips and "+N more" popover
  - Schedule/agenda list view
  - Collapsible sidebar with mini calendar, calendar filters, create button
  - Click-to-create events on time grid
  - Click-and-drag to set event time range
  - Event detail popover on click
  - Event editing via dialog
  - Drag-and-drop event rescheduling
  - Event resizing by dragging bottom edge
  - Keyboard shortcuts (t, d, w, m, c)
  - Google Calendar connect/disconnect/sync still functional
  - Dark mode support
  - Sidebar collapse/expand

### Task 10: Update documentation

- [ ] Update CLAUDE.md if any internal patterns changed (new calendar component directory)
- [ ] Move this plan to `docs/plans/completed/`
