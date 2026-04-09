# People Name Autocomplete — Potential Expanded View

**Date:** 2026-04-09
**Area:** `src/components/admin/PipelineExpandedView.tsx` — People (Related sidebar)

## Problem

When adding a person to a Potential deal in the expanded view, the "Name (required)" input is a plain text field. Users have to re-type names from scratch even when the person already exists in the `people` CRM table. This leads to typos, duplicate contact records, and loss of the linkage to existing CRM data (email, phone, title).

## Goal

When the user types in the Name field under the People section of a Potential expanded view, show a dropdown of matching people from the CRM. Selecting one fills name/title and silently copies email and phone into the new `entity_contacts` row so the deal's contact record is richer without adding visible inputs.

Free-text entry remains fully supported: if the typed name doesn't match anyone, the user can still hit Enter and create a free-text contact exactly as today.

## Non-Goals

- **No FK linkage.** `entity_contacts` has no `person_id` column and we are not adding one. The selected person's fields are *copied* into the new row, not referenced.
- **No changes to the Companies section, Tasks section, or any other Related sidebar section.**
- **No changes to the CRM People page** (`src/pages/admin/People.tsx`).
- **No shared autocomplete abstraction.** We will not refactor `RecipientAutocomplete` into a shared primitive — this is a focused change.

## Current State

**File:** `src/components/admin/PipelineExpandedView.tsx`

- Line 629: `const [newContactName, setNewContactName] = useState('');`
- Line 791: `handleSaveContact` — inserts into `entity_contacts` with `{ entity_id, entity_type, name, title }`
- Lines 2056–2080: the People add-form JSX with the two plain inputs

**Data:**
- `entity_contacts` columns: `id, entity_id, entity_type, name, email, phone, title, notes, is_primary, created_at, updated_at` — all free-text, no person FK
- `people` columns used by this feature: `id, name, title, email, phone, company_name`

**Prior art:** `src/components/admin/inbox/RecipientAutocomplete.tsx` has a close-enough autocomplete implementation (debounced `people` query, keyboard nav, rich dropdown rows). We'll mirror its structure but not reuse it — it's hard-coded for email-only output and uses slate-palette styling that doesn't match the expanded view's muted/border theme tokens.

## Design

### New component

Create `src/components/admin/PeopleNameAutocomplete.tsx` (flat under `admin/`, matching the existing convention — there is no `PipelineExpandedView/` subdirectory and we are not creating one for a single component).

**Props:**

```ts
interface PersonSuggestion {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
}

interface PeopleNameAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPersonSelect: (person: PersonSuggestion) => void;
  onEnter: () => void;       // called when Enter is pressed and no dropdown selection
  onEscape: () => void;      // called when Esc is pressed and dropdown is closed
  disabled?: boolean;
  excludeNames?: string[];   // lowercase names already attached to this deal
  placeholder?: string;
  autoFocus?: boolean;
}
```

**Behavior:**

1. Controlled input mirrors the existing `<input>` API — `value`, `onChange`, `disabled`.
2. When `value.trim().length >= 1`, debounced 200ms, query:
   ```ts
   supabase
     .from('people')
     .select('id, name, title, email, phone, company_name')
     .ilike('name', `${query.trim()}%`)
     .order('name', { ascending: true })
     .limit(8)
   ```
3. Filter results: drop any row whose `name.toLowerCase()` appears in `excludeNames`. This prevents suggesting people already attached to the deal.
4. Dropdown is absolutely positioned below the input, `z-50`, with the same rounded/border/bg tokens used elsewhere in the Related sidebar (`bg-popover`, `border-border`, `shadow-md`, `rounded-md`). Must look correct in both light and dark mode.
5. Rows render:
   - Left: 20px blue avatar circle with `name[0]` initial (matches existing People list styling at line 2046)
   - Right top: **name** (font-medium) + muted `· title` if present
   - Right bottom: muted `company_name` if present
6. Keyboard navigation:
   - `ArrowDown` / `ArrowUp` — move selection within dropdown
   - `Enter` — if a dropdown item is selected, pick it (call `onPersonSelect`, close dropdown); otherwise call `onEnter` (which will trigger the parent's save logic)
   - `Escape` — if dropdown is open, close it and stop the event; otherwise call `onEscape` (which will trigger the parent's cancel logic)
   - This "swallow Esc when dropdown is open" behavior is important — without it, pressing Esc to close the dropdown would also cancel the whole add-contact form
7. Click outside → close dropdown
8. Network error → log, hide dropdown, free-text entry still works
9. When `value` becomes empty, dropdown hides and results clear

### Parent changes in `PipelineExpandedView.tsx`

1. **Add two new state vars near `newContactName` (line 629):**
   ```ts
   const [newContactEmail, setNewContactEmail] = useState<string | null>(null);
   const [newContactPhone, setNewContactPhone] = useState<string | null>(null);
   ```
   These only hold values that came from a selected person; free-text entry leaves them `null`.

2. **Reset them alongside `newContactName`** in every place that currently resets the name/title (on save success, on Escape cancel, on close).

3. **Extend `handleSaveContact` (line 791):**
   ```ts
   const { error } = await supabase.from('entity_contacts').insert({
     entity_id: leadId,
     entity_type: 'potential',
     name: newContactName.trim(),
     title: newContactTitle.trim() || null,
     email: newContactEmail,
     phone: newContactPhone,
   });
   ```

4. **Replace the name `<input>` (lines 2058–2069)** with `<PeopleNameAutocomplete>`:
   ```tsx
   <PeopleNameAutocomplete
     autoFocus
     value={newContactName}
     onChange={(v) => {
       setNewContactName(v);
       // If user edits the name after picking a person, break the linkage
       // so we don't submit stale email/phone from a different person.
       setNewContactEmail(null);
       setNewContactPhone(null);
     }}
     onPersonSelect={(p) => {
       setNewContactName(p.name);
       if (p.title && !newContactTitle) setNewContactTitle(p.title);
       setNewContactEmail(p.email);
       setNewContactPhone(p.phone);
     }}
     onEnter={() => { if (newContactName.trim()) handleSaveContact(); }}
     onEscape={() => {
       setAddingContact(false);
       setNewContactName('');
       setNewContactTitle('');
       setNewContactEmail(null);
       setNewContactPhone(null);
     }}
     disabled={savingContact}
     excludeNames={contacts.map(c => c.name.toLowerCase())}
     placeholder="Name (required)"
   />
   ```

   The title `<input>` at lines 2070–2080 stays unchanged.

### Edge cases

| Case | Behavior |
|---|---|
| User types a name that matches nobody | Dropdown hides, Enter saves free-text (today's behavior) |
| User picks a person, then edits the name | `email`/`phone` are cleared (handled in `onChange`) so we don't submit mismatched data |
| User picks a person, then edits the title | Kept as-is; the selected title is just a default |
| Selected person has no email or phone | Pass `null`, `entity_contacts` columns are nullable |
| Person already attached to this deal | Filtered out of the dropdown via `excludeNames` |
| Rapid typing | 200ms debounce + query cancellation via `debounceRef` |
| Network error | Silent fail, dropdown hides, free-text still works |
| Dropdown open + Escape | Closes dropdown only (does not cancel the form) |
| Dropdown open + Enter on highlighted row | Picks that row, does not submit the form |
| Dropdown closed + Enter | Submits the form |

### Styling

Use theme tokens — not hard-coded slate colors — to stay consistent with the rest of the expanded view:

- Dropdown container: `absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-md overflow-hidden`
- Row hover: `hover:bg-muted`
- Row selected: `bg-accent text-accent-foreground`
- Avatar: same `bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400` the existing People list uses at line 2046
- Typography: same 12px/xs sizing as surrounding inputs

## Testing

No automated tests — this project has none. Manual smoke test plan:

1. Open a Potential deal expanded view
2. Click `+ Add person...` — input gets focus
3. Type a single letter that matches a `people` row → dropdown appears with up to 8 results
4. Arrow down → row highlights
5. Enter → name + title fill in, dropdown closes, cursor stays in form
6. Hit Enter again → contact saved, row appears in People list with correct name/title
7. Verify in DB / refetch: the new `entity_contacts` row has `email` and `phone` copied from the matched person
8. Re-open add form, type a letter → the just-added person is no longer in the dropdown (duplicate filter)
9. Type a name that matches nobody → dropdown hidden, Enter saves as free-text with `email`/`phone` null
10. Pick a person, then backspace/edit the name → email/phone get cleared
11. Open dropdown, press Esc → dropdown closes, form stays open
12. Press Esc again (dropdown closed) → form cancels and clears
13. Toggle to dark mode → dropdown still legible, matches sidebar theme

## Out of Scope / Future

- Adding a `person_id` FK column to `entity_contacts` so deal contacts can be truly linked to CRM people (would require a migration and query updates across PeopleDetailPanel etc.)
- Applying the same autocomplete pattern to the Companies section (`company_name` search against `companies` table)
- Extracting a shared `EntityAutocomplete<T>` primitive — defer until we have a third call site
