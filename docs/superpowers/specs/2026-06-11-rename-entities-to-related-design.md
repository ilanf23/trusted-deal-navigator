# Design: Rename `entities` → `related` (database + codebase)

**Date:** 2026-06-11
**Status:** Approved
**Approach:** One-shot atomic rename (single migration + scripted codebase rename, deployed together)

## Goal

Rename every mention of the polymorphic "entities" system to "related", aligning the
data model with the "Related" concept already used in the UI (e.g. `LeadRelatedSidebar`).
Full-depth rename: tables, columns, enums, functions, triggers, constraints, indexes,
policies, code identifiers, component/file names, and user-visible strings.

The app is pre-production with fake data, so the brief breakage window between
`db:push` and code deploy is acceptable, and destructive/data migrations are low-risk.

## Scope decisions (user-confirmed)

1. **Depth:** Full rename — everything, including `entity_id` → `related_id`,
   `entity_phones` → `related_phones`, `entity_type_enum` → `related_type_enum`,
   all code identifiers, file names, DB functions and triggers.
2. **Convention:** Plain swap (`related_*`), not `related_record_*`.
3. **UI text:** Also renamed; identifiers get the plain swap, but visible sentences use
   "related record(s)" where bare "related" reads broken
   (e.g. "Delete this entity?" → "Delete this related record?").

## Database migration

One new migration file. Historical migrations are never edited.

### Enums
- `entity_type_enum` → `related_type_enum`
- `entity_kind` → `related_kind`
- Enum **values** (`people`, `companies`, `deal`, `potential`, `lender_programs`, …) are
  unchanged — no stored row values change meaning.

### Tables (8)
| Old | New |
| --- | --- |
| `entities` | `related` |
| `entity_addresses` | `related_addresses` |
| `entity_emails` | `related_emails` |
| `entity_phones` | `related_phones` |
| `entity_files` | `related_files` |
| `entity_followers` | `related_followers` |
| `entity_projects` | `related_projects` |
| `entity_orphans` | `related_orphans` |

### Columns
- `entity_id` → `related_id` and `entity_type` → `related_type` in **every** table that
  has them (~15 tables incl. `tasks`, `communications`, `deal_contacts`, `notifications`,
  the child tables, and the source tables `people`/`companies`/`deals`/`lender_programs`).
- `entity_orphans.original_entity_type` → `original_related_type`,
  `original_entity_id` → `original_related_id`.

### Constraints and indexes
Explicit `RENAME CONSTRAINT` / `ALTER INDEX … RENAME` for every name containing
`entity`. **Required, not cosmetic:** frontend code uses FK constraint names in
PostgREST embed hints (e.g. `entities!people_entity_id_fkey(…)` in `useGmailLogic.ts`),
so `people_entity_id_fkey` must become `people_related_id_fkey`, etc.

### Functions and triggers (silent-breakage zone)
plpgsql function bodies are stored as text and do NOT track table renames. Drop and
recreate with new names and updated bodies:
- `create_parent_entity()` → `create_parent_related()`
- `delete_parent_entity()` → `delete_parent_related()`
- `sync_child_entity_type()` → `sync_child_related_type()`
- `cleanup_deal_polymorphic_children()` — keeps its name, body rewritten.

All ~16 triggers renamed (`trg_people_create_entity` → `trg_people_create_related`,
`trg_entity_emails_sync_type` → `trg_related_emails_sync_type`, etc.).

RLS policy bodies survive table renames (stored as parsed expressions); only policy
names containing "entity" are renamed via `ALTER POLICY … RENAME`.

### Data migration
Rewrite `ai_events.payload` jsonb keys `entity_id`/`entity_type` →
`related_id`/`related_type` (including nested keys) so undo/redo continues to work on
pre-rename events.

## Codebase rename

~945 matching lines in `src/` plus the Supabase edge functions
(`twilio-inbound`, `twilio-voice`, `twilio-call-history`, `twilio-token`,
`score-deal-win-percentage`, `dropbox-mutations`, `_shared/aiAgent/executor.ts`).

### Replacement script
Word-boundary-aware, ordered longest-identifier-first so longer tokens are consumed
before their prefixes:
1. `entity_type_enum` → `related_type_enum`
2. Child table names: `entity_addresses|emails|phones|files|followers|projects|orphans` → `related_*`
3. `entity_id` → `related_id`, `entity_type` → `related_type`, `entity_kind` → `related_kind`
4. camelCase: `entityTypeValue` → `relatedTypeValue`, `entityType` → `relatedType`,
   `entityId` → `relatedId`, `entityName` → `relatedName`, `entityLabel` → `relatedLabel`,
   `entityEmails` → `relatedEmails`, `entityContacts` → `relatedContacts`,
   `entityRefs` → `relatedRefs`, `entityRef` → `relatedRef`
5. PascalCase: `Entity*` → `Related*`, `Entities` → `Related`
6. Bare `entities` → `related`, `entity` → `related` (word-boundary)

**Protected by word boundaries:** `identity` (Twilio token identity — contains the
substring `entit`), and pre-existing `related`, `relatedTo`, `related_to`,
`relatedToId`, `relatedPeople`, `relatedDeals` identifiers are never touched.

### File renames (3)
- `src/lib/entityRefs.ts` → `src/lib/relatedRefs.ts`
- `src/components/admin/files/EntityFilesSection.tsx` → `RelatedFilesSection.tsx`
- `src/components/admin/shared/EntityCallHistorySection.tsx` → `RelatedCallHistorySection.tsx`

Imports are updated by the same text replacement.

### Excluded from the script
- `src/integrations/supabase/types.ts` — regenerated from the live DB after `db:push`.
- `schema.md` — regenerated via `npm run generate-schema`.
- `supabase/migrations/**` — historical migrations stay untouched.

### Known collision (hand-fixed)
`const entities = …` → `const related = …` can redeclare in scopes that already use a
`related` variable. The TypeScript build flags each one; fix locally with a scoped name
(e.g. `relatedRecords`).

### UI strings and docs
User-visible "entity" wording reviewed individually, using "related record(s)" where
needed. `CLAUDE.md` files updated where they mention the entities system.

## Order of operations

1. Write migration → `npm run db:push`
2. `npm run generate-schema`; regenerate `types.ts` from the live DB
3. Run codebase rename script + 3 file renames + manual collision/UI-string fixes
4. `npm run build` and `npm run lint` — must pass clean
5. Leftover sweep: word-boundary grep for surviving `entity|entities` tokens
   (excluding `identity`); expect zero outside historical migrations
6. `npm run functions:deploy`
7. Smoke test (dev server):
   - Create a person/company/deal — exercises recreated `create_parent_related()` trigger
   - Open detail panels — Related sidebar, files section, call history
   - Gmail compose — exercises the renamed FK embed hint
   - Task linking to people/deals
   - Delete + undo a deal — exercises migrated `ai_events` jsonb payload keys
   - Inbound/outbound call contact resolution (edge functions)

## Error handling

- The migration runs in a single transaction; any failure rolls back the whole rename.
- If `db:push` succeeds but the code rename hits unexpected build errors, the app is
  briefly broken in dev — acceptable pre-prod; fix forward.
- If verification fails badly, rollback = `git checkout` for code + a reverse migration
  (mechanical inverse of the rename migration).

## Testing

No automated test suite exists in this repo. Verification is: clean build, clean lint,
zero-leftover grep sweep, and the manual smoke-test list above.
