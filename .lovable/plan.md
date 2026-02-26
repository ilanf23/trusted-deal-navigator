

## Plan: Replace Lead Detail Dialog with Right Sidebar Panel

Currently, clicking a lead row opens a `LeadDetailDialog` (centered modal). The screenshot from Copper CRM shows a right-side detail panel that appears inline within the page layout. This plan converts the click behavior to show a right sidebar panel instead.

### What changes

When a user clicks a lead row in the table (or a card in Kanban), a right-side detail panel slides in showing the deal's details with tabs for DETAILS, ACTIVITY, and RELATED -- matching the Copper CRM reference screenshot.

### Technical approach

**New file: `src/components/admin/UnderwritingDetailPanel.tsx`** (~250 lines)

A right sidebar panel component that renders inline (not as a Sheet/Dialog overlay) within the page layout. It will include:

- **Header**: Lead name, company, value, close button, "Follow" button
- **"$ Opportunity" badge** (matching the screenshot)
- **Three tabs**: DETAILS, ACTIVITY, RELATED (using shadcn Tabs)
- **DETAILS tab fields**: Name, Pipeline ("Underwriting"), Stage (with dropdown), CLX File Name, Waiting On, Tags, Value, Description
- **ACTIVITY / RELATED tabs**: placeholder content for now
- Fields rendered as label/value pairs matching the Copper CRM style

**Modified file: `src/pages/admin/EvansUnderwriting.tsx`**

1. **Replace dialog with inline panel**: Remove the `LeadDetailDialog` usage. Instead, when a lead is clicked, set `selectedLead` state (already exists) and render the new `UnderwritingDetailPanel` as a right-side column in the flex layout.

2. **Layout change**: The body area becomes a 3-column flex:
   - Left sidebar (filters) -- existing
   - Main content (table/kanban) -- existing, shrinks when panel is open
   - Right detail panel -- new, ~380px wide, slides in when a lead is selected

3. **`handleRowClick`**: Instead of opening a dialog, just sets `selectedLead`. The panel renders conditionally based on `selectedLead !== null`.

4. **Close behavior**: An X button on the panel sets `selectedLead` back to `null`.

### Panel field mapping (from DB lead data)

| Field | Source |
|-------|--------|
| Name | `lead.name` |
| Pipeline | "Underwriting" (static for this page) |
| Stage | `stageConfig[lead.status].label` with Select dropdown |
| CLX File Name | Derived from company name or lead field |
| Waiting On | `lead.tags` or placeholder |
| Tags | `lead.tags` array rendered as badges |
| Value | `fakeValue(lead.id)` (existing helper) |
| Description | `lead.notes` or loan amount info |

### Files

- **New**: `src/components/admin/UnderwritingDetailPanel.tsx`
- **Modified**: `src/pages/admin/EvansUnderwriting.tsx` (swap dialog for inline panel, adjust layout)

