# Email Templates

**Status:** live
**Portal:** Sales Rep
**Route:** `/admin/email-templates`
**Source file:** `src/pages/admin/EmailTemplates.tsx`
**Last reviewed:** 2026-05-11

---

## Purpose

A shared library of reusable email bodies that reps can drop into Gmail replies and follow-ups. Standardizes voice and saves typing on the dozens of repetitive emails reps send each week (intro, doc requests, lender hand-offs, etc.).

## Primary user

Sales rep composing outreach — wants to grab a tested template and tweak it rather than write from scratch. Secondary: founders/ops curating the master set of templates.

## Entry points

- Sidebar nav: **Communication → Email Templates**
- Gmail composer → *Insert Template* (reads from this table)

## What the user can do here

- Browse all email templates by name and optional category
- Create a new template (name, subject, body, category)
- Edit an existing template inline
- Delete a template
- Preview body before saving

## Key business rules

- Templates are global (shared across all reps), not per-user
- Body is plain text/HTML stored as-is; merge fields (e.g. `{{lead_name}}`) are resolved at send time by the Gmail composer
- Deleting a template is permanent — no soft delete
- Category is optional and free-text (not enum) — used only for grouping in the list

## Data shown

| Field | Source | Notes |
|-------|--------|-------|
| Name | `email_templates.name` | Primary identifier |
| Subject | `email_templates.subject` | Used as Gmail subject when applied |
| Body | `email_templates.body` | Plain text or HTML |
| Category | `email_templates.category` | Nullable, free-text |

## User flows

### 1. Create a new template
1. Click **+ New Template**
2. Fill in name, subject, body, optional category
3. Save → `INSERT INTO email_templates` → list refreshes

### 2. Edit an existing template
1. Click the pencil icon on a row
2. Dialog opens prefilled
3. Save → `UPDATE email_templates`

### 3. Use a template in Gmail
1. In Gmail composer, click *Insert Template*
2. Pick from list → subject + body pre-fill
3. Edit / personalize → send

## Edge cases & known gaps

- No versioning — overwrites lose prior copy
- No search/filter beyond the alphabetical list (gets slow past ~50 templates)
- Merge field syntax isn't validated in the editor; bad placeholders surface only at send time
- No per-user favorites or recent-used surfacing

---

## Technical anchors

### Components used
- Page-level component (no extracted children); uses shadcn `Card`, `Dialog`, `Input`, `Textarea`

### Hooks / contexts
- TanStack Query (`useQuery`, `useMutation`) directly against Supabase
- `useAdminTopBar` for page title

### Data sources

| Table | Read | Write |
|-------|------|-------|
| `email_templates` | ✓ | ✓ (insert / update / delete) |

### Edge functions
- None — direct Supabase client calls

### Permissions
- Route gate: `AdminRoute`
- RLS: any admin can read/write (templates are shared resource)

## Open questions

- [ ] Per-user favorites or recent list?
- [ ] Rich-text editor vs raw HTML?
- [ ] Validate merge fields against a known schema?
- [ ] Soft delete + history so accidentally deleted templates can be recovered?
