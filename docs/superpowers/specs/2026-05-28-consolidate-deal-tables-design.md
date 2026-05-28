# Deal Table Consolidation — Design Proposal (#97)

**Status:** Draft — requires review by Sergii (@Serginyo90) + ≥1 founder before any implementation ticket.
**Scope:** Discovery only. No migration SQL, no app refactoring, no deploys (those are follow-up tickets).
**Last updated:** 2026-05-28

## TL;DR

The three tables (`potential`, `underwriting`, `lender_management`) are **the same entity at three stages**, and the codebase already treats them that way:

- **69 of their columns are identical.** `potential` adds 10 prospect-only fields; `underwriting`/`lender_management` add only the (dead) `origin_pipeline_id`.
- The deal-move logic is **already a single-identity model**: the `move_deal_between_pipelines` RPC (migration `20260409202724`) moves a deal between tables **preserving its UUID** and re-points all polymorphic children. It does *not* copy-and-keep — the ticket's "copy on move" fear is already partly addressed, but in the most fragile way possible.
- `origin_pipeline_id` is **vestigial** — referenced only in generated `types.ts`, never read or written by app code or the RPC.
- The current move-by-RPC approach has a **real data-loss bug**: it copies only 60 of the 69 shared columns, so `deal_outcome`, `won_at`, `lost_at`, `won_reason`, `custom_fields`, `copper_opportunity_id`, `source_system`, `interactions_count`, and `stage_changed_at` are **reset to defaults/NULL every time a deal changes pipeline**.

**Recommendation (pending team sign-off): consolidate into a single `deals` table with a `pipeline` enum.** It eliminates the move-RPC, the data loss, the dead `origin_pipeline_id`, the three junction tables, and most `entity_type` discriminator usage — and the schema is already 87% of the way there.

---

## 1. Column-level diff

Source: `schema.md` — `potential` (79 cols), `underwriting` (70), `lender_management` (70). Computed via `comm` over the three sorted column lists.

### 1a. Shared by all three (69 columns) — keep as-is on the consolidated table

`about, actual_net_revenue, assigned_to, bank_relationships, client_other_lenders, close_date, clx_agreement, clx_file_name, cohort_year, company_name, contact_type, converted_at, converted_to_client_id, copper_opportunity_id, created_at, custom_fields, deal_outcome, deal_value, description, email, fee_percent, flagged_for_weekly, history, id, initial_nudge_created_at, interactions_count, invoice_amount, known_as, last_activity_at, last_contacted, lender_name, lender_type, loan_category, loan_stage, loss_reason, lost_at, name, net_revenue, next_action, notes, opportunity_name, phone, potential_revenue, priority, qualified_at, referral_source, rs_fee_percent, rs_revenue, sheets_last_synced_at, sheets_row_index, sla_threshold_days, source, source_system, stage_changed_at, stage_id, status, tags, target_closing_date, title, updated_at, uw_number, visibility, volume_log_status, waiting_on, win_percentage, won, won_at, won_reason, wu_date`

### 1b. Only on `potential` (10 prospect-only columns)

| Column | Disposition |
| --- | --- |
| `questionnaire_token`, `questionnaire_sent_at`, `questionnaire_completed_at` | **Keep** (nullable) — only populated in the prospect stage; harmless as NULL elsewhere. Candidate for `custom_fields` if the team wants a lean core table. |
| `ratewatch_questionnaire_token`, `ratewatch_questionnaire_sent_at`, `ratewatch_questionnaire_completed_at` | **Keep** (nullable) — same rationale; tied to RateWatch flow. |
| `website`, `work_website`, `linkedin`, `twitter` | **Keep** (nullable) — contact-enrichment fields. Low cost to retain. |

Recommendation: **keep all 10 as nullable columns** rather than moving to `custom_fields`. They are typed, occasionally queried, and the move RPC already drops them silently today — keeping them as real columns is strictly safer. Revisit `custom_fields` only if the team wants a minimal core schema.

### 1c. Only on `underwriting` + `lender_management` (1 column)

| Column | Disposition |
| --- | --- |
| `origin_pipeline_id uuid → potential` | **Drop.** Vestigial — see §4 / Open Q2. Not read anywhere; its FK target would be orphaned by consolidation anyway. |

### 1d. No columns are unique to `underwriting` alone or `lender_management` alone.

**Net:** consolidated table = 69 shared + 10 prospect-only = **79 columns**, minus the dropped `origin_pipeline_id`, plus one new `pipeline` enum column (§2).

---

## 2. Pipeline modeling decision

**Question (Open Q1): one entity at three stages, or three distinct workflows?**
Evidence says **one entity at three stages**:

1. **87% column identity** (69/79) with zero stage-specific columns on underwriting/lender_management.
2. The **move RPC already preserves a single UUID** across the move and re-points every polymorphic child — i.e. the system already models a deal as one stable identity that changes pipeline, not three separate records.
3. `pipeline_stages.pipeline_id` already partitions stages by pipeline (§6), so stage semantics survive a merge with no new infrastructure.
4. The three `_people` junction tables are byte-for-byte identical (§5).

### Options

**Option A — single `deals` table + `pipeline` enum (RECOMMENDED, pending team confirm).**
One row per deal for its entire life. A `pipeline` enum column (`potential | underwriting | lender_management`) replaces "which table am I in." Moving pipeline becomes a one-field `UPDATE` — no row copy, no child re-pointing, no data loss.
- Eliminates: `move_deal_between_pipelines` RPC, `origin_pipeline_id`, the 60-vs-69 column data-loss bug (§9), two of the three junction tables, and most `entity_type` usage (§4).
- Cost: large code refactor (§7) and a backfill migration (§8).

**Option B — keep three tables but stop duplicating; share via FK.**
More conservative. Keeps the three-name branching in ~62 files and does not fix the data-loss bug or the discriminator sprawl. Given the move RPC already preserves identity, Option B delivers little over the status quo.

**Recommendation: Option A.** Mark for explicit team sign-off (Open Q1) before implementation.

---

## 3. Naming

Candidates: `deals`, `pipeline_deals`, or keep `potential`.

- **`deals` (recommended).** Clearest, matches the existing `deal_outcome` / `deal_priority` / `deal_milestones` / `deal_responses` vocabulary already in the schema. Renaming cost is low: only **5 real inbound FK columns** point at these tables (§4), and the polymorphic children use `entity_id` + `entity_type` (no hard FK), so they are unaffected by the table name.
- **Keep `potential`.** Avoids renaming those 5 FK columns but is semantically wrong (a won lender-management deal is not "potential") and confusing for future devs.
- **`pipeline_deals`.** Fine, but redundant given the `pipeline` enum lives on the row.

**Recommendation: `deals`**, with the matching junction renamed `deal_people` (§5). Confirm with team.

---

## 4. Foreign-key map & `entity_type` usage

### 4a. Inbound FKs (hard foreign keys) — only 5 columns, all to `potential`

| Table.column | Targets | Note |
| --- | --- | --- |
| `dropbox_files.lead_id` | `potential` | also carries `entity_type` |
| `email_threads.lead_id` | `potential` | also carries `entity_type` |
| `rate_watch.lead_id` | `potential` | also carries `entity_type` |
| `tasks.lead_id` | `potential` | also carries `entity_type` |
| `potential_people.potential_id` | `potential` | junction (§5) |
| `underwriting_people.underwriting_id` | `underwriting` | junction (§5) |
| `lender_management_people.lender_management_id` | `lender_management` | junction (§5) |
| `underwriting.origin_pipeline_id` / `lender_management.origin_pipeline_id` | `potential` | **vestigial — drop** |

Because only `potential` is a hard-FK target, consolidating into `deals` requires re-pointing just these columns (rename `lead_id` → `deal_id` is optional polish).

### 4b. `entity_type` discriminator — 30 tables

The polymorphic pattern. Tables carrying `entity_type`:
`active_calls, activities, activity_comments, appointments, call_events, call_rating_notifications, communications, deal_lender_programs, deal_milestones, deal_responses, deal_waiting_on, dropbox_files, email_threads, entity_addresses, entity_contacts, entity_emails, entity_files, entity_followers, entity_phones, entity_projects, notes, outbound_emails, partner_referrals, person_connections, person_other_contacts, project_people, rate_watch, ratewatch_questionnaire_responses, tasks, underwriting_checklists`.

**`entity_type_enum` values** (from migrations): `pipeline`, `underwriting`, `lender_management`, `potential`, `lender_programs`, plus `people`/`companies` (used in code).

**Distinct values actually compared in code:** `'potential'` (15 refs), `'people'` (14), `'underwriting'` (10), `'lender_management'` (4), `'deal'` (2), `'companies'` (1).

### 4c. Retirement assessment (Open Q3)

`entity_type` **cannot be removed entirely** — it also discriminates `people` and `companies`. But after consolidation the three deal values (`potential`/`pipeline` + `underwriting` + `lender_management`) **collapse to a single `deal` value**, because one stable `deals.id` no longer needs a "which table" tag.

- **Tables that ONLY tag deals → `entity_type` becomes constant and can be dropped:** `deal_lender_programs`, `deal_milestones`, `deal_responses`, `deal_waiting_on`, `underwriting_checklists` (verify each tags nothing but deals).
- **Tables that also tag `people`/`companies`/`lender_programs` → keep `entity_type`, but merge the three deal values into one `deal`:** `activities`, `entity_*`, `communications`, `dropbox_files`, `email_threads`, `rate_watch`, `tasks`, `notes`, `outbound_emails`, `appointments`, `partner_referrals`, etc.

Either way, the **`move_deal_between_pipelines` RPC's 13 child-table UPDATE statements all disappear** (no move = no re-pointing).

---

## 5. Junction tables

`potential_people`, `underwriting_people`, `lender_management_people` are **structurally identical**: `id, <pipeline>_id, person_id, role, created_at`.

**Plan:** collapse to one **`deal_people`** (`id, deal_id, person_id, role, created_at`). The move RPC's junction-migration step (insert into target junction + delete from source) is then deleted entirely. Backfill: union all three, mapping each `<pipeline>_id` → `deal_id`.

---

## 6. Stage model

**Confirmed: `pipeline_stages` already distinguishes by pipeline** via `pipeline_stages.pipeline_id → pipelines`. The seed migration `20260226120000_seed_copper_pipelines.sql` creates system pipelines named `Potential` / `Underwriting` / `Lender Management`.

Implications for consolidation:
- A consolidated `deals` row needs only `stage_id` (FK to `pipeline_stages`) **plus** the `pipeline` enum from §2. The `pipeline` enum is technically derivable from `stage_id → pipeline_stages.pipeline_id`, but a denormalized enum is worth keeping for fast filtering and index-friendly board queries.
- Today the move RPC resets `stage_id` to the **first stage of the target pipeline**. In the consolidated model, changing `pipeline` should still re-seed `stage_id` to that pipeline's first stage — preserve this behavior in the follow-up.
- No new stage infrastructure required.

---

## 7. Code-reference inventory

**62 files in `src/`** (excluding generated `types.ts`) + **8 edge functions** reference the three table names. Scope input for the refactor follow-up.

### 7a. Edge functions (8) — mostly reads

| Function | Behavior |
| --- | --- |
| `score-deal-win-percentage` | reads `potential`, **writes `potential.win_percentage`**, filters children by `entity_type='potential'` (note the `'potential'` vs `'pipeline'` enum mismatch — §9) |
| `google-sheets-sync` | read/write sync against `sheets_row_index` / `sheets_last_synced_at` (§9 risk) |
| `ai-assistant-agent`, `lead-ai-assistant`, `generate-lead-email`, `call-to-lead-automation`, `twilio-call-history` | read deal data / branch on table names |
| `_shared` | helper utilities referencing table names |

### 7b. `src/` files (62), grouped by behavior

**WRITE to one of the three tables (14):** `usePipelineMutations.ts` (the move/CRUD hub), `useLeadEmailCompose.ts`, `LeadDetailDialog.tsx`, `PipelineExpandedView.tsx`, `UnderwritingExpandedView.tsx`, `UnderwritingDetailPanel.tsx`, `LenderManagementExpandedView.tsx`, `ProjectExpandedView.tsx`, `ProjectDetailPanel.tsx`, `ExpandedLeftColumn.tsx`, `shared/LeadRelatedSidebar.tsx`, `pages/admin/Potential.tsx`, `pages/admin/CRMBoard.tsx`, `pages/admin/EmployeePipeline.tsx`.

**Triple-pipeline branching (branches on all three names — highest-risk refactor, 8 files):** these hardcode `potential`/`underwriting`/`lender_management` switches and must be rewritten to a single table + `pipeline` filter. (Includes `usePipelineMutations.ts`, `useAllPipelineLeads.ts`, the dashboard hooks, `MoveBoxesModal.tsx`, `PipelineRecordsSection.tsx` — confirm exact set during refactor.)

**Read-only / display (remaining ~40):** dashboard hooks (`useSuperAdminDashboard`, `useAdamsDashboard`, `useMaurasDashboard`, `useWendysDashboard`), feed (`useFeedData`, `FeedRightPanel`), pages (`Dashboard`, `Scorecard`, `TeamPerformance`, `LoanVolumeLog`, `LenderManagement`, `Underwriting`, `Calls`, `RateWatch`, `Projects`, `Marketing`, `PipelineFeed`), employee widgets, expanded views, etc.

**Key constants to centralize:** `usePipelineMutations.ts` already defines `CrmTable`, `QUERY_KEY_MAP`, `PIPELINE_LABELS`, `ENTITY_TYPE_MAP` — these are the natural seam for the refactor.

---

## 8. Migration plan sketch (high-level — NO SQL)

Staged and reversible; old tables kept until reads+writes verified.

1. **Create** `deals` (79 cols − `origin_pipeline_id` + `pipeline` enum) and `deal_people`. Additive; reversible.
2. **Backfill** `deals` by UNION of all three tables, setting `pipeline` per source table and preserving each row's `id`. Backfill `deal_people` from the three junctions. **De-dupe note:** because the move RPC preserves UUIDs and deletes the source row, a given deal exists in only one table at a time, so UNION should not collide — but verify no orphaned duplicates exist before cutover. Additive; reversible.
3. **Migrate discriminators / FKs:** repoint the 5 inbound FK columns to `deals`; merge the three deal `entity_type` values into `deal` on polymorphic children; drop `entity_type` on deal-only child tables (§4c). Reversible with a saved mapping.
4. **Switch reads** behind a flag — point queries/hooks at `deals`, validate dashboards, feed, scorecard against parallel old-table reads.
5. **Switch writes** — route inserts/updates and the (now trivial) pipeline-change to `deals`; delete `move_deal_between_pipelines` and its client wrapper.
6. **Drop** `potential` / `underwriting` / `lender_management`, the three junctions, `origin_pipeline_id`, and redundant `entity_type` columns. **Point of no return.**

**Rollback:** phases 1–3 are additive (drop new objects to revert). Phases 4–5 are flag-flips (revert the flag). Keep old tables through phase 5; only phase 6 is irreversible — gate it behind a sign-off + a verified backup.

---

## 9. Risk list

| Risk | Detail | Mitigation |
| --- | --- | --- |
| **Existing data-loss bug** | Move RPC copies only 60/69 shared cols → `deal_outcome`, `won_at`, `lost_at`, `won_reason`, `custom_fields`, `copper_opportunity_id`, `source_system`, `interactions_count`, `stage_changed_at` are reset on every pipeline move. | Consolidation **fixes** this (no move). Audit historical rows for already-lost data before backfill; don't trust these fields on rows that were moved. |
| **`entity_type` enum inconsistency** | Move RPC writes `'pipeline'` for potential deals; the `20260411` rename added `'potential'`; `score-deal-win-percentage` queries `entity_type='potential'`. Two values for one concept. | Reconcile to a single `deal` value during phase 3. Verify which value live child rows actually carry before merging. |
| **Google Sheets sync** | `google-sheets-sync` + `LoanVolumeLog.tsx` rely on `sheets_row_index` / `sheets_last_synced_at` per table. | Preserve these columns on `deals`; verify row mapping survives backfill; stage the sync cutover. |
| **Copper import** | `copper_opportunity_id` carried on all three; not copied by move RPC (so may already be lost on moved rows). | Ensure uniqueness across merged rows; dedupe on backfill; reconcile against Copper. |
| **`score-deal-win-percentage`** | Reads `potential`, writes `potential.win_percentage`, filters children by `entity_type`. | Repoint to `deals`; update the `entity_type` filter to the merged `deal` value. |
| **Dashboard / scorecard queries** | ~40 read-only files (dashboard hooks, Scorecard, TeamPerformance, feed) count/aggregate per-table. | Rewrite to filter `deals.pipeline`; validate numbers against old tables behind the read flag. |
| **Move RPC removal** | `move_deal_between_pipelines` + `moveDealBetweenPipelines()` client wrapper must be removed, not bypassed, or stale copies could reappear. | Delete in phase 5; replace UI move action with a `pipeline` update + stage re-seed. |
| **Triple-branching code (8 files)** | Hardcoded three-name switches are the highest-risk refactor surface. | Centralize on the `usePipelineMutations.ts` constants; refactor file-by-file behind the read flag. |

---

## Open questions (answers)

**Q1 — Same entity at three stages, or distinct workflows?**
**Same entity at three stages.** 87% column identity, no stage-specific columns, and the move RPC already models one stable UUID across pipelines. → Recommend single `deals` table (§2). *Needs team sign-off.*

**Q2 — What is `origin_pipeline_id` doing today? Is it read? Does the app rely on copy-on-move?**
**It is dead.** `origin_pipeline_id` appears only in generated `types.ts` — never read or written by app code, edge functions, or the move RPC (which explicitly comments that it intentionally does not set it). There is **no copy-on-move-and-keep** behavior; the RPC *moves* (preserves UUID, deletes source). → Drop the column.

**Q3 — Should `entity_type` go away entirely?**
**No — partially.** It still discriminates `people`/`companies`/`lender_programs`. But the three deal values collapse to one `deal` value, the move RPC's 13 re-pointing UPDATEs disappear, and `entity_type` can be dropped on deal-only child tables (§4c).

---

## Acceptance

- [x] Design proposal in `docs/` covering all 9 deliverables — **this document**.
- [ ] Reviewed by Sergii (@Serginyo90) + ≥1 founder before any follow-up implementation ticket is opened.
