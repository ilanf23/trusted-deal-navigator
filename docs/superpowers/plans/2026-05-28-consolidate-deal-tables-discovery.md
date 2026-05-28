# Consolidate Deal Tables — Discovery Plan (Ticket #97)

> **For agentic workers:** This is a **discovery-only** plan. The deliverable is a written design proposal — NO migration SQL, NO app refactoring, NO deploys (all explicitly out of scope in #97). Steps use checkbox (`- [ ]`) syntax for tracking. There are no tests; each task instead produces a concrete section of the proposal document and is "done" when that section is written with real data (no placeholders).

**Goal:** Produce a reviewed design proposal for consolidating `potential`, `underwriting`, and `lender_management` into a single deal table, covering all 9 ticket deliverables, so follow-up implementation tickets can be scoped confidently.

**Architecture:** The proposal is a single markdown document with one section per deliverable. We build it bottom-up: gather hard facts from `schema.md` and the codebase first (column diff, FK map, code inventory), then layer the design decisions (naming, pipeline modeling, junction collapse, discriminator retirement) on top, then the migration sketch and risk list, and finally route it for team review.

**Tech Stack:** Postgres (Supabase), `schema.md` (generated schema reference), `grep`/`rg` over `src/` and `supabase/functions/`, Supabase MCP / `npm run generate-schema` for live DB verification.

**Output document:** `docs/superpowers/specs/2026-05-28-consolidate-deal-tables-design.md`

**Facts already confirmed during planning (use these; re-verify only the flagged ones):**
- Three tables: `potential` (~80 cols), `underwriting`, `lender_management` (~70 cols). Heavy overlap; `potential` carries the extra early-stage fields (`questionnaire_*`, `ratewatch_questionnaire_*`, `website`, `linkedin`, `twitter`, `work_website`).
- `underwriting` and `lender_management` both have `origin_pipeline_id uuid → potential`. `potential` does not.
- `pipeline_stages` **already has `pipeline_id → pipelines`** — stage-by-pipeline distinction already exists in the schema.
- Three parallel junction tables: `potential_people`, `underwriting_people`, `lender_management_people` (each id / <table>_id / person_id / role / created_at).
- Confirmed inbound FKs that point **only at `potential`**: `dropbox_files.lead_id`, `email_threads.lead_id`, `rate_watch.lead_id`, `tasks.lead_id`, `potential_people.potential_id`. Plus `underwriting_people.underwriting_id → underwriting` and `lender_management_people.lender_management_id → lender_management`.
- `entity_type` discriminator appears on **30 tables** (full list captured in Task 4).
- Code references: **63 files in `src/`** and **8 edge functions** (`ai-assistant-agent`, `call-to-lead-automation`, `generate-lead-email`, `google-sheets-sync`, `lead-ai-assistant`, `score-deal-win-percentage`, `twilio-call-history`, plus `_shared`) reference the three table names.

---

### Task 0: Scaffold the proposal document

**Files:**
- Create: `docs/superpowers/specs/2026-05-28-consolidate-deal-tables-design.md`

- [ ] **Step 1: Create the document skeleton**

Create the file with a title, a "Status: Draft — for review by Sergii + ≥1 founder" line, a "Last updated: 2026-05-28" line, and these nine empty section headings matching the ticket deliverables, in this order:

```markdown
# Deal Table Consolidation — Design Proposal (#97)

**Status:** Draft — requires review by Sergii + ≥1 founder before any implementation ticket.
**Last updated:** 2026-05-28

## 1. Column-level diff
## 2. Pipeline modeling decision
## 3. Naming
## 4. Foreign-key map & entity_type usage
## 5. Junction tables
## 6. Stage model
## 7. Code-reference inventory
## 8. Migration plan sketch
## 9. Risk list
## Open questions (answers)
```

- [ ] **Step 2: Commit**

```bash
git checkout -b feat/97-deal-consolidation-discovery
git add docs/superpowers/specs/2026-05-28-consolidate-deal-tables-design.md
git commit -m "docs(#97): scaffold deal consolidation proposal"
```

---

### Task 1: Column-level diff (Deliverable 1)

**Files:**
- Modify: `docs/superpowers/specs/2026-05-28-consolidate-deal-tables-design.md` (§1)
- Source: `schema.md` lines 646–719 (`lender_management`), 957–1039 (`potential`), 1223–1297 (`underwriting`)

- [ ] **Step 1: Extract each table's column set**

Run:
```bash
for t in potential underwriting lender_management; do
  echo "=== $t ==="
  awk "/## Table: \`$t\`/{f=1;next} /^## Table:/{f=0} f && /^\| [a-z]/ {print \$2}" schema.md | sort
done
```
Expected: three sorted column lists you can diff by eye / with `comm`.

- [ ] **Step 2: Build the diff table**

Run pairwise `comm` to find columns unique to each table:
```bash
awk "/## Table: \`potential\`/{f=1;next} /^## Table:/{f=0} f && /^\| [a-z]/ {print \$2}" schema.md | sort > /tmp/potential.cols
awk "/## Table: \`underwriting\`/{f=1;next} /^## Table:/{f=0} f && /^\| [a-z]/ {print \$2}" schema.md | sort > /tmp/uw.cols
awk "/## Table: \`lender_management\`/{f=1;next} /^## Table:/{f=0} f && /^\| [a-z]/ {print \$2}" schema.md | sort > /tmp/lm.cols
echo "--- only in potential ---"; comm -23 /tmp/potential.cols <(cat /tmp/uw.cols /tmp/lm.cols | sort -u)
echo "--- shared by all three ---"; comm -12 /tmp/potential.cols /tmp/uw.cols | comm -12 - /tmp/lm.cols
```

- [ ] **Step 3: Write §1**

In §1, produce a three-column presence matrix (column | in potential? | in underwriting? | in lender_management? | data type) plus, for every column that is NOT in all three, a disposition decision: **keep** (promote to all rows, nullable), **drop** (dead column — verify zero code refs in Task 7 before recommending drop), or **move to `custom_fields` jsonb**. Note that all three already have a `custom_fields jsonb NOT NULL` column to absorb rarely-used fields.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-05-28-consolidate-deal-tables-design.md
git commit -m "docs(#97): column-level diff of the three deal tables"
```

---

### Task 2: Foreign-key map & entity_type usage (Deliverable 4)

> Done before the modeling decision because the FK/discriminator picture is the strongest evidence for whether one table is the right shape.

**Files:**
- Modify: proposal §4

- [ ] **Step 1: List all inbound FKs to the three tables**

Run:
```bash
grep -nE "\| (potential|underwriting|lender_management) +\|" schema.md
```
For each hit, resolve the owning table:
```bash
for ln in $(grep -nE "\| (potential|underwriting|lender_management) +\|" schema.md | cut -d: -f1); do
  awk -v L=$ln 'NR<=L && /^## Table:/{t=$0} NR==L{print t" (line "L")"}' schema.md
done
```
Expected: confirms `dropbox_files`, `email_threads`, `rate_watch`, `tasks`, `potential_people` → `potential`; `underwriting_people` → `underwriting`; `lender_management_people` → `lender_management`; plus the `origin_pipeline_id → potential` on uw + lm.

- [ ] **Step 2: List all tables carrying `entity_type`**

Run:
```bash
for ln in $(grep -nE "\| entity_type" schema.md | cut -d: -f1); do
  awk -v L=$ln 'NR<=L && /^## Table:/{t=$0} NR==L{gsub(/## Table: /,"",t);print t}' schema.md
done | sort -u
```
Expected: 30 tables (active_calls, activities, activity_comments, appointments, call_events, call_rating_notifications, communications, deal_lender_programs, deal_milestones, deal_responses, deal_waiting_on, dropbox_files, email_threads, entity_addresses, entity_contacts, entity_emails, entity_files, entity_followers, entity_phones, entity_projects, notes, outbound_emails, partner_referrals, person_connections, person_other_contacts, project_people, rate_watch, ratewatch_questionnaire_responses, tasks, underwriting_checklists).

- [ ] **Step 3: Find what `entity_type` is actually compared against in code**

Run:
```bash
rg -n "entity_type" src supabase/functions | rg -i "potential|underwriting|lender|lead|deal" | head -60
```
Expected: shows which discriminator values exist and where they branch — this tells us whether retiring `entity_type` is safe after consolidation (since a single deal id would no longer need a "which table" tag).

- [ ] **Step 4: Write §4**

Document: (a) a table of every inbound FK grouped by which of the three it targets; (b) the 30-table `entity_type` list with the distinct values each uses; (c) a retirement assessment — "after consolidation, `entity_type` on tables that only ever distinguish potential/underwriting/lender_management becomes redundant and can be dropped; tables that also discriminate `person`/`company`/other must keep it." Flag each of the 30 tables as "can drop entity_type" vs "must keep".

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-05-28-consolidate-deal-tables-design.md
git commit -m "docs(#97): inbound FK map and entity_type retirement assessment"
```

---

### Task 3: Investigate `origin_pipeline_id` and the copy-on-move behavior (Open Question 2)

**Files:**
- Modify: proposal "Open questions" section

- [ ] **Step 1: Find every read/write of `origin_pipeline_id`**

Run:
```bash
rg -n "origin_pipeline_id" src supabase/functions
```
Expected: classify each hit as write-only (set on insert, never read) vs read (used in a query/join/UI). If it's write-only, the "copy" link is bookkeeping the app doesn't depend on.

- [ ] **Step 2: Find the code path that moves a deal between tables**

Run:
```bash
rg -n "from\('(underwriting|lender_management)'\)" src supabase/functions | rg -i "insert|upsert"
rg -ni "advance|promote|convert|move.*stage|origin_pipeline" src/hooks src/components/admin/pipeline | head -40
```
Expected: locate the insert-into-next-table logic. Confirm whether rows are copied (duplicated) or whether there is in fact a single-row update path already.

- [ ] **Step 3: Write the Open Question 2 answer**

Document: is a deal copied on move? Is `origin_pipeline_id` ever read? Does anything rely on the copy behavior? This directly feeds the modeling decision (Task 5).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-05-28-consolidate-deal-tables-design.md
git commit -m "docs(#97): document origin_pipeline_id and copy-on-move behavior"
```

---

### Task 4: Code-reference inventory (Deliverable 7)

**Files:**
- Modify: proposal §7

- [ ] **Step 1: Enumerate all referencing files, grouped by area**

Run:
```bash
echo "=== src files ==="; grep -rlE "'(potential|underwriting|lender_management)'|\"(potential|underwriting|lender_management)\"" src | sort
echo "=== edge functions ==="; grep -rlE "potential|underwriting|lender_management" supabase/functions | cut -d/ -f1-3 | sort -u
```
Expected: ~63 src files + 8 edge functions.

- [ ] **Step 2: Classify each file by behavior**

For each file, tag it read-only / write / dual-pipeline-branching. Fast triage:
```bash
for f in $(grep -rlE "'(potential|underwriting|lender_management)'" src); do
  echo "## $f"; rg -n "from\('(potential|underwriting|lender_management)'\)\.(insert|update|upsert|delete|select)" "$f" | head
done
```
Expected: a per-file behavior tag. Files that branch on all three names ("dual/triple-pipeline logic") are the ones the refactor follow-up must touch carefully.

- [ ] **Step 3: Write §7**

Produce a table: file path | area (hook / page / component / edge fn) | behavior (read / write / branches-on-table-name) | refactor effort (low/med/high). Group by area. This is the scope input for the follow-up implementation ticket — note the total count and call out any file that hardcodes all three names.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-05-28-consolidate-deal-tables-design.md
git commit -m "docs(#97): code-reference inventory grouped by behavior"
```

---

### Task 5: Pipeline modeling decision + naming (Deliverables 2 & 3, Open Questions 1 & 3)

> This is the central judgment call. It depends on Tasks 1–4. **Requires team input** — do not decide unilaterally; present the evidence and a recommendation.

**Files:**
- Modify: proposal §2, §3, and Open Questions

- [ ] **Step 1: Synthesize the evidence**

Pull together: column overlap % (Task 1), the fact that FKs/discriminator exist purely to track "which table" (Tasks 2–3), copy-on-move behavior (Task 3), and `pipeline_stages.pipeline_id` already existing (Task 6). Write the case for each option.

- [ ] **Step 2: Write §2 with a recommendation and the alternative**

Document two options with trade-offs:
- **Option A (recommended pending team confirm):** single table with a `pipeline` enum (`potential | underwriting | lender_management`), one stable `id` per deal for its whole life. Eliminates copies, drift, broken FKs, and most `entity_type` usage.
- **Option B:** keep tables split but stop copying — share one canonical deal row via FK. More conservative, but keeps the 3-name branching in code.
State which the data supports and explicitly mark this as **needs team sign-off** (Open Question 1).

- [ ] **Step 3: Write §3 (naming)**

Recommend a final table name from candidates `deals` / `pipeline_deals` / keep `potential`. Note migration cost of renaming vs reusing `potential` (reusing avoids renaming the many FKs already pointing at `potential`). Mark as a decision to confirm with the team.

- [ ] **Step 4: Answer Open Question 3 (`entity_type` removal)**

Using Task 2's per-table assessment, state whether `entity_type` goes away entirely (likely "yes for deal-only tables, no for tables that also tag person/company").

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-05-28-consolidate-deal-tables-design.md
git commit -m "docs(#97): pipeline modeling decision, naming, entity_type verdict"
```

---

### Task 6: Stage model + junction tables (Deliverables 5 & 6)

**Files:**
- Modify: proposal §5, §6
- Source: `schema.md` `pipeline_stages` (has `pipeline_id → pipelines`), `pipelines`, the three `_people` tables (lines 721, 1041, 1323)

- [ ] **Step 1: Confirm the stage model**

Run:
```bash
rg -n "pipeline_stages|pipeline_id|stage_id" src/constants src/hooks src/utils | head -40
```
Verify `pipeline_stages.pipeline_id` already separates stages per pipeline, and check how the app currently maps a row in each of the three tables to its pipeline's stages.

- [ ] **Step 2: Write §6 (stage model)**

Document that `pipeline_stages` already distinguishes by pipeline via `pipeline_id`, so a consolidated deal row needs only `stage_id` (+ the `pipeline` enum from §2) — no new stage infrastructure required. Note any place that currently infers pipeline from the table name instead of `stage_id`.

- [ ] **Step 3: Write §5 (junction tables)**

Document collapsing `potential_people` + `underwriting_people` + `lender_management_people` into one `deal_people` (id / deal_id / person_id / role / created_at). Note they are structurally identical today, so the collapse is clean once the parent tables merge.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-05-28-consolidate-deal-tables-design.md
git commit -m "docs(#97): stage model confirmation and deal_people junction plan"
```

---

### Task 7: Migration plan sketch + risk list (Deliverables 8 & 9)

> High-level steps only — **no SQL** (out of scope).

**Files:**
- Modify: proposal §8, §9

- [ ] **Step 1: Write §8 (migration sketch)**

Document the staged, reversible sequence at a high level: (1) create new consolidated table (or extend `potential` if that name wins) + `deal_people`; (2) backfill rows from all three tables, deduping deals that were copied across tables (key on `origin_pipeline_id` chain); (3) repoint inbound FKs and migrate `entity_type`-tagged rows; (4) switch reads behind a flag; (5) switch writes; (6) drop old tables + redundant `entity_type` columns. Add a **rollback note** per phase (keep old tables until reads+writes verified; phases 1–3 are additive and reversible, phase 6 is the point of no return).

- [ ] **Step 2: Write §9 (risk list)**

Cover, with a mitigation per item:
- **`google-sheets-sync` / `google-sheets-api`** — `sheets_row_index` / `sheets_last_synced_at` mapping per table; row mapping must survive consolidation.
- **Copper import** — `copper_opportunity_id` uniqueness across merged rows; dedupe on backfill.
- **`score-deal-win-percentage`** — reads/writes `win_percentage`; confirm it queries by id not table name.
- **Dashboard queries** — `src/components/admin/dashboard` aggregations that count per-table; will need rewrite to filter by `pipeline`.
- **The copy-on-move logic** (Task 3) — must be removed, not just bypassed, or it'll re-duplicate.
Run a quick confirm:
```bash
rg -n "sheets_row_index|copper_opportunity_id|win_percentage" src supabase/functions | head -40
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-05-28-consolidate-deal-tables-design.md
git commit -m "docs(#97): migration sketch and risk list"
```

---

### Task 8: Verify against live DB and route for review

**Files:**
- Modify: proposal (fix any drift), then PR

- [ ] **Step 1: Spot-check schema.md against the live DB**

`schema.md` is generated and may lag. Verify the column counts and the existence of `origin_pipeline_id`, `custom_fields`, and `pipeline_stages.pipeline_id` against the live DB (Supabase MCP `list_tables`, or `npm run generate-schema` and re-diff). Note any discrepancy in the proposal.

- [ ] **Step 2: Self-review the proposal against the ticket**

Walk all 9 deliverables + 3 open questions in #97 and confirm each maps to a written section with real data — no "TBD". Fix gaps inline.

- [ ] **Step 3: Open the PR and request review**

```bash
git push -u origin feat/97-deal-consolidation-discovery
gh pr create --title "Discovery: consolidate deal tables proposal (#97)" \
  --body "Design proposal for #97 (discovery only — no migration/refactor). Requests review per acceptance criteria: Sergii + ≥1 founder before any implementation ticket is opened." \
  --base main
```
Then request review from Sergii (@Serginyo90) and a founder. **Acceptance criteria met only after that review** — do not open implementation tickets until then.

---

## Self-Review (against ticket #97)

| Ticket deliverable | Task |
| --- | --- |
| 1. Column-level diff | Task 1 |
| 2. Pipeline modeling decision | Task 5 |
| 3. Naming | Task 5 |
| 4. FK map + entity_type | Task 2 |
| 5. Junction tables | Task 6 |
| 6. Stage model | Task 6 |
| 7. Code-reference inventory | Task 4 |
| 8. Migration plan sketch | Task 7 |
| 9. Risk list | Task 7 |
| Open Q1 (same entity?) | Task 5 |
| Open Q2 (origin_pipeline_id) | Task 3 |
| Open Q3 (drop entity_type?) | Task 2 + Task 5 |
| Acceptance: doc in docs/ + reviewed by Sergii + founder | Task 0 + Task 8 |

All deliverables and open questions map to a task. Out-of-scope items (migration SQL, refactoring, deploying) are explicitly excluded from every task.
