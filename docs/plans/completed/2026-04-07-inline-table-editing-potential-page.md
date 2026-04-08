---
# Inline Table Editing for Potential Page

## Overview

Enable direct inline editing of cell values in the Potential page table. Clicking on text/words in a cell enters edit mode for that value. Clicking on whitespace (empty area) in a cell opens the detail sidebar panel as before. Only applies to the Potential page.

## Context

- Files involved:
  - `src/pages/admin/Potential.tsx` — main page with table rendering (lines 1405-1601)
  - `src/components/admin/InlineEditableCell.tsx` — existing inline edit component (already handles stopPropagation)
  - `src/hooks/usePipelineMutations.ts` — existing mutation patterns for the potential table
- Related patterns: `InlineEditableCell` already supports text and select types with click-to-edit and stopPropagation behavior. The `PipelineDetailPanel` uses `useInlineSave` from `InlineEditableFields.tsx` for Supabase updates.
- The `<tr>` has `onClick={handleRowClick}` which opens the detail panel. Since `InlineEditableCell` calls `e.stopPropagation()` on text clicks, whitespace clicks will still bubble up to the row handler and open the detail panel naturally.

## Editable vs Non-Editable Columns

- **Editable (text):** Deal name (`name`), Company (`company_name`), Contact (`name`), Value (`deal_value`)
- **Editable (select):** Owner (`assigned_to`), Stage (`stage_id`)
- **Non-editable (computed/read-only):** Tasks, Status, Days in Stage, Stage Updated, Last Contacted, Interactions, Inactive Days, Tags

Non-editable columns keep their current behavior — any click in those cells bubbles to the row handler and opens the detail panel.

## Development Approach

- No new files needed — modifications only to `Potential.tsx`
- Reuse the existing `InlineEditableCell` component
- Direct Supabase updates with TanStack Query cache invalidation
- No test suite exists in this project per CLAUDE.md, so verification is manual/build-based

## Implementation Steps

### Task 1: Add inline cell save handler to Potential.tsx

**Files:**
- Modify: `src/pages/admin/Potential.tsx`

- [x] Import `InlineEditableCell` from `@/components/admin/InlineEditableCell`
- [x] Add a `handleInlineCellSave` async function that takes `(leadId: string, field: string, value: string)`, updates `supabase.from('potential').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', leadId)`, shows error toast on failure, and invalidates the `potential-deals` query key on success
- [x] For the Owner field specifically, update `assigned_to` and also update the local `leadOwnerMap` state
- [x] Run `npm run build` to verify no type errors

### Task 2: Convert text columns to inline-editable

**Files:**
- Modify: `src/pages/admin/Potential.tsx`

- [x] Replace the Deal name `<span>` (line ~1449) with `<InlineEditableCell value={lead.name} onChange={(v) => handleInlineCellSave(lead.id, 'name', v)} />` — keep the existing text styling via className props
- [x] Replace the Company `<span>` (line ~1468) with `<InlineEditableCell value={lead.company_name || ''} onChange={(v) => handleInlineCellSave(lead.id, 'company_name', v)} />`
- [x] Replace the Contact `<span>` (line ~1478) with `<InlineEditableCell value={lead.name} onChange={(v) => handleInlineCellSave(lead.id, 'name', v)} />`
- [x] Replace the Value `<span>` (line ~1485) with `<InlineEditableCell value={lead.deal_value?.toString() || ''} onChange={(v) => handleInlineCellSave(lead.id, 'deal_value', v)} placeholder="—" />` — wire up the currently hardcoded "—" to the actual `deal_value` field
- [x] Run `npm run build` to verify no type errors

### Task 3: Convert select columns to inline-editable

**Files:**
- Modify: `src/pages/admin/Potential.tsx`

- [x] Replace the Owner cell content with `<InlineEditableCell type="select" value={effectiveOwnerId || ''} options={teamMembers.map(m => ({ id: m.id, label: m.name }))} onChange={(v) => handleInlineCellSave(lead.id, 'assigned_to', v)} placeholder="—" />` — keep the avatar display in the non-editing state or simplify to name-only for the select
- [x] Replace the Stage cell content with `<InlineEditableCell type="select" value={lead._stageId || ''} options={stages.map(s => ({ id: s.id, label: dynamicStageConfig[s.id]?.title || s.name }))} onChange={(v) => handleStageMove(lead.id, v)} />` — reuse the existing stage configuration and mutation
- [x] Run `npm run build` to verify no type errors

### Task 4: Verify acceptance criteria

- [x] Run `npm run build` — must pass with no errors
- [x] Run `npm run lint` — must pass (all errors pre-existing, none introduced by inline editing)
- [x] Verify: clicking on text in an editable cell enters edit mode (does NOT open detail panel) (manual test - skipped, not automatable)
- [x] Verify: clicking on whitespace in any cell opens the detail sidebar (manual test - skipped, not automatable)
- [x] Verify: editing a value and pressing Enter or clicking away saves the change (manual test - skipped, not automatable)
- [x] Verify: pressing Escape cancels the edit (manual test - skipped, not automatable)
