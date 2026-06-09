# Change a deal's primary contact from the People table

**Date:** 2026-06-09
**Status:** Approved

## Problem

A deal's primary contact is set at creation time and stored denormalized on the
`deals` row (`name`, `email`, `phone`, `title`). After creation there is no way to
pick a different primary contact from the company's roster of people. The only
existing control — a "switch primary contact" popover in `ExpandedLeftColumn.tsx`
— appears solely when the deal already has secondary contacts in `entity_contacts`,
and it swaps the primary with one of those rows. It cannot pull a contact from the
`people` table.

## Goal

Let a user change a deal's primary contact after creation by selecting any person
from the `people` table.

## Scope

A single, focused change to the **"Primary Contact"** section of
`src/components/admin/ExpandedLeftColumn.tsx` (currently lines ~529–615), which is
shared by the Potential, Underwriting, and Lender Management expanded views.

No database schema change. No change to the deal creation flow
(`AddOpportunityDialog`). No change to secondary-contact management in
`LeadDetailDialog`'s Contacts tab.

## Decisions (from brainstorming)

- **Old primary:** Just replaced. The previous primary's values are overwritten;
  it is not demoted into `entity_contacts`.
- **Data model:** Copy fields only. No `person_id` FK, no migration. The selected
  person's identity fields are copied onto the deal.
- **Placement:** Replace the existing "switch primary contact" popover with a
  people-table search picker.
- **Fields copied:** Contact identity only — `name`, `email`, `phone`, `title`.
  The deal's `company_name` is left untouched.
- **Missing person:** Search only. If a person is not in the `people` table, the
  user adds them on the People page first. No inline "create person".

## Behavior

**Today:** The switch button renders only when `otherContacts.length > 0`
(secondary contacts from `entity_contacts`). It demotes the current primary into
`entity_contacts` and promotes the chosen secondary.

**New:** The switch button is **always shown**. Clicking it opens a popover with a
debounced search box over the `people` table. Picking a person overwrites the
deal's `name`, `email`, `phone`, `title` with that person's values. The previous
primary is replaced (not saved). `company_name` is left untouched.

## Components & data flow

### 1. People search

Inside the popover, a debounced search input queries `people`, reusing the pattern
already used in `RecipientAutocomplete.tsx`:

```ts
supabase.from('people')
  .select('id, name, email, phone, title, company_name')
  .or(`name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`)
  .order('name', { ascending: true })
  .limit(10)
```

Results render as a list (avatar, name, title, email/company) consistent with the
current popover row styling.

### 2. `setPrimaryContact` mutation

Replaces the existing `swapPrimaryContact` mutation. It performs a single update:

```ts
supabase.from('deals').update({
  name: person.name,
  title: person.title,
  email: person.email,
  phone: person.phone,
}).eq('id', lead.id)
```

On success: call `onFieldSaved('name', person.name)` to trigger the parent
expanded-view's lead refetch + "Updated" toast, then close the popover and show a
"Primary contact updated" toast.

### 3. Removals

- The `otherContacts` query (`entity_contacts` lookup) in `ExpandedLeftColumn` is
  removed — it was only feeding the old swap list.
- The `swapPrimaryContact` mutation is removed.
- The `otherContacts.length > 0` gate around the trigger button is removed (button
  is always present).
- The footer copy ("The current primary will be moved into Contacts.") is removed,
  since we no longer demote.

Secondary contacts in `entity_contacts` remain managed in `LeadDetailDialog`'s
Contacts tab — untouched by this change.

## Edge cases

- **Empty search input:** show a hint ("Type to search people").
- **No results:** show "No people found — add them on the People page first."
- **In-flight mutation:** trigger button shows the existing spinner state; result
  rows are disabled while pending.
- Trigger button keeps its current hover/focus styling.

## Out of scope (YAGNI)

- No inline "create person" from the picker.
- No `person_id` FK column or migration.
- No change to `AddOpportunityDialog` creation flow.
- No change to `entity_contacts` secondary-contact management.
