
# Remove Priority Feature from Module Tracker

## What's Being Removed

Priority fields and badges appear in 4 files across both modules and business requirements. This is a pure UI/form cleanup — no database migration needed (the `priority` column can stay in the DB, we just stop displaying or editing it in the UI).

## Changes Per File

### 1. `src/components/admin/modules/ModuleCard.tsx`
- Remove the `PRIORITY_STYLES` constant (lines 25–30)
- Remove `priority: string` from the `Module` interface (line 42)
- Remove the priority `<Badge>` from the card header JSX (line 80–82)

### 2. `src/components/admin/modules/ModuleDetailDialog.tsx`
- Remove `priority: z.string()` from the zod schema (line 26)
- Remove `priority: 'medium'` from `form.reset()` defaultValues (line 61)
- Remove `priority: module.priority` from the `useEffect` reset (line 73)
- Remove the Priority `<FormField>` block from the Details form (lines 179–191)

### 3. `src/components/admin/modules/RequirementsTable.tsx`
- Remove `priority: string` from the `BusinessRequirement` interface (line 27)
- Remove the `PRIORITY_STYLES` constant (lines 39–44)
- Remove `priority: z.string()` from the zod schema (line 53)
- Remove `priority: 'medium'` from `form` defaultValues (line 72)
- Remove `priority` from `insertData` in `handleAdd` (line 97)
- Remove the `Priority` `<TableHead>` column header (line 159)
- Remove the priority `<Badge>` `<TableCell>` in each row (lines 182–185)
- Update `colSpan={7}` on the empty state row to `colSpan={6}` (line 168)
- Remove the Priority `<FormField>` block from the add dialog (lines 256–268)

### 4. `src/pages/admin/ModuleTracker.tsx`
- Remove `priority: z.string()` from the zod schema (line 25)
- Remove `priority: 'medium'` from `form` defaultValues (line 46)
- Remove the Priority `<FormField>` block from the Add Module dialog (lines 220–232)
- The grid of 4 items will now become 3 — adjust `grid-cols-2` to remain or collapse naturally

## What This Does NOT Touch
- No database migration — the `priority` column stays in the DB (existing seeded data remains intact, nothing breaks)
- No route or sidebar changes
- The `Module` interface still needs `priority` to avoid TypeScript errors since Supabase returns it — we'll keep it as optional (`priority?: string`) in the type definition so existing data doesn't break anything, we just won't render it

## Files to Change

| File | Change |
|------|--------|
| `src/components/admin/modules/ModuleCard.tsx` | Remove `PRIORITY_STYLES`, `priority` from interface, priority badge from JSX |
| `src/components/admin/modules/ModuleDetailDialog.tsx` | Remove priority from schema, defaultValues, reset, and form field |
| `src/components/admin/modules/RequirementsTable.tsx` | Remove priority from interface, styles, schema, defaultValues, insert, table column, table cell, and form field |
| `src/pages/admin/ModuleTracker.tsx` | Remove priority from schema, defaultValues, and Add Module form field |
