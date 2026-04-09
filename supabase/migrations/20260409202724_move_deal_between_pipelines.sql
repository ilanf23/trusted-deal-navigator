-- ============================================================
-- Migration: move_deal_between_pipelines RPC
-- ============================================================
-- Atomically moves a deal row from one pipeline table
-- (potential / underwriting / lender_management) to another.
--
-- The operation:
--   1. Copies the shared columns into the target table,
--      preserving the deal's UUID so related records (which
--      reference the deal polymorphically via entity_id) do
--      not need to change their FK value.
--   2. Resets stage_id to the first stage of the target
--      pipeline (as defined in public.pipelines + pipeline_stages).
--   3. Updates entity_type on every polymorphic child table.
--   4. Migrates rows in the pipeline-specific people junction
--      tables (potential_people / underwriting_people /
--      lender_management_people).
--   5. Deletes the original row.
--
-- Notes:
--   * Potential has ten prospect-only fields (linkedin, twitter,
--     website, work_website, and six questionnaire_* / ratewatch_*
--     tokens). These are dropped silently when moving out of
--     Potential, and are left NULL when moving into Potential.
--   * origin_pipeline_id is intentionally not set — its FK targets
--     the potential table, which would be orphaned after the DELETE.
--   * The ENTITY_TYPE_MAP mirrors the client-side constant in
--     src/hooks/usePipelineMutations.ts: potential ↔ 'pipeline'.
-- ============================================================

create or replace function public.move_deal_between_pipelines(
  p_deal_id uuid,
  p_source  text,
  p_target  text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- 60 columns shared between potential / underwriting / lender_management.
  -- Excludes the 10 prospect-only columns on potential (linkedin, twitter,
  -- website, work_website, questionnaire_*, ratewatch_*) and
  -- origin_pipeline_id (underwriting/lender_management only).
  v_shared_cols constant text := 'id, about, actual_net_revenue, assigned_to, bank_relationships, client_other_lenders, close_date, clx_agreement, clx_file_name, cohort_year, company_name, contact_type, converted_at, converted_to_client_id, created_at, deal_value, description, email, fee_percent, flagged_for_weekly, history, initial_nudge_created_at, invoice_amount, known_as, last_activity_at, last_contacted, lender_name, lender_type, loan_category, loan_stage, loss_reason, name, net_revenue, next_action, notes, opportunity_name, phone, potential_revenue, priority, qualified_at, referral_source, rs_fee_percent, rs_revenue, sheets_last_synced_at, sheets_row_index, sla_threshold_days, source, status, tags, target_closing_date, title, updated_at, uw_number, visibility, volume_log_status, waiting_on, win_percentage, won, wu_date';
  v_source_enum entity_type_enum;
  v_target_enum entity_type_enum;
  v_target_pipeline_name text;
  v_target_stage_id uuid;
  v_source_junction text;
  v_source_junction_fk text;
  v_target_junction text;
  v_target_junction_fk text;
  v_exists boolean;
begin
  -- Validate inputs
  if p_source = p_target then
    return;
  end if;
  if p_source not in ('potential', 'underwriting', 'lender_management') then
    raise exception 'Invalid source pipeline: %', p_source;
  end if;
  if p_target not in ('potential', 'underwriting', 'lender_management') then
    raise exception 'Invalid target pipeline: %', p_target;
  end if;

  -- Map table name → entity_type enum
  v_source_enum := case p_source
    when 'potential'         then 'pipeline'::entity_type_enum
    when 'underwriting'      then 'underwriting'::entity_type_enum
    when 'lender_management' then 'lender_management'::entity_type_enum
  end;
  v_target_enum := case p_target
    when 'potential'         then 'pipeline'::entity_type_enum
    when 'underwriting'      then 'underwriting'::entity_type_enum
    when 'lender_management' then 'lender_management'::entity_type_enum
  end;

  -- Display name of the target pipeline (matches public.pipelines.name from
  -- the seed migration 20260226120000_seed_copper_pipelines.sql)
  v_target_pipeline_name := case p_target
    when 'potential'         then 'Potential'
    when 'underwriting'      then 'Underwriting'
    when 'lender_management' then 'Lender Management'
  end;

  -- Ensure the source row exists before doing any work
  execute format('select exists(select 1 from public.%I where id = $1)', p_source)
    into v_exists
    using p_deal_id;
  if not v_exists then
    raise exception 'Deal % not found in %', p_deal_id, p_source;
  end if;

  -- Look up the first stage of the target pipeline (lowest position).
  -- Best-effort: if no stage is found the deal is inserted with stage_id = null.
  select ps.id
    into v_target_stage_id
  from public.pipeline_stages ps
  join public.pipelines p on p.id = ps.pipeline_id
  where p.name = v_target_pipeline_name
    and p.is_system = true
  order by ps.position asc
  limit 1;

  -- 1. Copy the shared columns into the target table.
  --    The new row reuses the original UUID so all polymorphic
  --    children (activities, entity_*, etc.) stay attached.
  --    stage_id is overridden with the target pipeline's first stage.
  execute format(
    'insert into public.%I (%s, stage_id) '
    'select %s, $2 from public.%I where id = $1',
    p_target, v_shared_cols, v_shared_cols, p_source
  )
  using p_deal_id, v_target_stage_id;

  -- 2. Re-point every polymorphic child table at the new entity_type.
  --    The entity_id does not change because we preserved the UUID.
  update public.activities             set entity_type = v_target_enum where entity_id = p_deal_id and entity_type = v_source_enum;
  update public.entity_emails          set entity_type = v_target_enum where entity_id = p_deal_id and entity_type = v_source_enum;
  update public.entity_phones          set entity_type = v_target_enum where entity_id = p_deal_id and entity_type = v_source_enum;
  update public.entity_files           set entity_type = v_target_enum where entity_id = p_deal_id and entity_type = v_source_enum;
  update public.entity_addresses       set entity_type = v_target_enum where entity_id = p_deal_id and entity_type = v_source_enum;
  update public.entity_contacts        set entity_type = v_target_enum where entity_id = p_deal_id and entity_type = v_source_enum;
  update public.entity_followers       set entity_type = v_target_enum where entity_id = p_deal_id and entity_type = v_source_enum;
  update public.entity_projects        set entity_type = v_target_enum where entity_id = p_deal_id and entity_type = v_source_enum;
  update public.deal_lender_programs   set entity_type = v_target_enum where entity_id = p_deal_id and entity_type = v_source_enum;
  update public.deal_responses         set entity_type = v_target_enum where entity_id = p_deal_id and entity_type = v_source_enum;
  update public.person_connections     set entity_type = v_target_enum where entity_id = p_deal_id and entity_type = v_source_enum;
  update public.person_other_contacts  set entity_type = v_target_enum where entity_id = p_deal_id and entity_type = v_source_enum;
  update public.underwriting_checklists set entity_type = v_target_enum where entity_id = p_deal_id and entity_type = v_source_enum;

  -- 3. Migrate rows in the per-pipeline people junction tables.
  --    Each junction has the same schema (id, person_id, <pipeline>_id, role, created_at)
  --    but its FK column is named after its pipeline.
  v_source_junction := p_source || '_people';
  v_source_junction_fk := p_source || '_id';
  v_target_junction := p_target || '_people';
  v_target_junction_fk := p_target || '_id';

  execute format(
    'insert into public.%I (person_id, %I, role, created_at) '
    'select person_id, $1, role, created_at from public.%I where %I = $1',
    v_target_junction, v_target_junction_fk, v_source_junction, v_source_junction_fk
  )
  using p_deal_id;

  execute format(
    'delete from public.%I where %I = $1',
    v_source_junction, v_source_junction_fk
  )
  using p_deal_id;

  -- 4. Remove the original row. Because we preserved the UUID this is
  --    the last step — any child record still pointing at the source
  --    enum would be missed by step 2 above, but the UPDATE already
  --    covered every polymorphic table.
  execute format('delete from public.%I where id = $1', p_source)
    using p_deal_id;
end;
$$;

grant execute on function public.move_deal_between_pipelines(uuid, text, text) to authenticated;
