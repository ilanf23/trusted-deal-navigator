

## Plan: Build Expanded Lead Full View Page

The Maximize2 button in the `UnderwritingDetailPanel` will navigate to a new full-page view that matches the Copper CRM screenshot -- a 3-column layout with lead details on the left, activity feed in the center, and related records on the right.

### Layout (matching the screenshot)

```text
┌──────────────────────────────────────────────────────────────────────┐
│  X  │  Lead Name (truncated)                     │ Follow │ ⬜ │ ⋯ │
│     │  Company / $Value                                             │
│     │  [$ Opportunity]                                              │
├──────────────────────────────────────────────────────────────────────┤
│          │ 1066        │ 10/7/2025      │ 142          │ 903        │
│          │ Interactions│ Last Contacted │ Inactive Days│ Days in Stg│
├────────────┬─────────────────────────────────┬───────────────────────┤
│ LEFT       │ CENTER                          │ RIGHT                 │
│ Details    │ Log Activity / Create Note tabs │ People (1)        +   │
│            │                                 │ Companies (1)     +   │
│ Name *     │ To Do ▼                         │ Tasks (0)         +   │
│ Pipeline ▼ │ [note input area]               │  + Add task...        │
│ Stage    ▼ │ [formatting toolbar]            │ Files (0)         +   │
│ CLX File   │                                 │ Calendar Events   +   │
│ Waiting On │ Earlier                         │ Projects (1)      +   │
│ Tags       │ [activity entries...]           │ Pipeline Records  +   │
│ Value      │                                 │                       │
│ Description│                                 │                       │
└────────────┴─────────────────────────────────┴───────────────────────┘
```

### New files

**`src/components/admin/UnderwritingExpandedView.tsx`** (~280 lines)

A full-page component rendered as a new route. Three-column layout:

1. **Left column** (~300px): Lead detail fields (Name, Pipeline dropdown, Stage dropdown, CLX File Name, Waiting On, Tags, Value, Description, "+ Add new field" link). Matches existing `DetailRow` pattern from the sidebar panel.

2. **Top stats bar**: Four metric boxes -- Interactions, Last Contacted, Inactive Days, Days in Stage. Computed from lead data (created_at, last_contacted, etc.).

3. **Center column** (flex-1): Two tabs -- "Log Activity" and "Create Note". Log Activity shows a "To Do" dropdown + text area with formatting toolbar placeholder. Below that, "Earlier" section with activity entries (placeholder for now, will show email/note history).

4. **Right column** (~250px): Collapsible sections for People, Companies, Tasks, Files, Calendar Events, Projects, Pipeline Records. Each shows count and a "+" button. Tasks section includes "+ Add task..." link.

5. **Header**: Close (X) button that navigates back, Follow button, lead name + company + value, Opportunity badge.

### Route addition

**`src/App.tsx`**: Add route:
```
/admin/evan/pipeline/underwriting/lead/:leadId → UnderwritingExpandedView
```

### Wiring the expand button

**`src/components/admin/UnderwritingDetailPanel.tsx`**:
- Add `onExpand` callback prop
- Wire Maximize2 button to call `onExpand`

**`src/pages/admin/EvansUnderwriting.tsx`**:
- Pass `onExpand` to `UnderwritingDetailPanel` that navigates to `/admin/evan/pipeline/underwriting/lead/${lead.id}`

### Data flow

The expanded view will:
- Accept `leadId` from route params
- Fetch the lead from the database using React Query
- Reuse `stageConfig`, `formatValue`, team member lookup from shared constants/hooks
- Activity/related sections start as placeholder UI matching the screenshot layout

### Files

- **New**: `src/components/admin/UnderwritingExpandedView.tsx`
- **Modified**: `src/App.tsx` (add route)
- **Modified**: `src/components/admin/UnderwritingDetailPanel.tsx` (add `onExpand` prop)
- **Modified**: `src/pages/admin/EvansUnderwriting.tsx` (pass `onExpand` with navigation)

