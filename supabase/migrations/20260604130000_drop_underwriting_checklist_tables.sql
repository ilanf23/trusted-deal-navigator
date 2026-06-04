-- ============================================================
-- Migration: drop underwriting_checklists + underwriting_checklist_items
-- ============================================================
-- Product decision (issue #109): the per-deal underwriting checklist
-- feature is being removed. Both tables were empty (pre-production).
-- The checklist_templates / checklist_template_items tables are
-- intentionally KEPT for a possible future rebuild.
--
-- move_deal_between_pipelines() still references underwriting_checklists
-- in its step-2 entity_type re-point, so we recreate it without that
-- line before dropping the tables.
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
  if p_source = p_target then
    return;
  end if;
  if p_source not in ('potential', 'underwriting', 'lender_management') then
    raise exception 'Invalid source pipeline: %', p_source;
  end if;
  if p_target not in ('potential', 'underwriting', 'lender_management') then
    raise exception 'Invalid target pipeline: %', p_target;
  end if;

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

  v_target_pipeline_name := case p_target
    when 'potential'         then 'Potential'
    when 'underwriting'      then 'Underwriting'
    when 'lender_management' then 'Lender Management'
  end;

  execute format('select exists(select 1 from public.%I where id = $1)', p_source)
    into v_exists
    using p_deal_id;
  if not v_exists then
    raise exception 'Deal % not found in %', p_deal_id, p_source;
  end if;

  select ps.id
    into v_target_stage_id
  from public.pipeline_stages ps
  join public.pipelines p on p.id = ps.pipeline_id
  where p.name = v_target_pipeline_name
    and p.is_system = true
  order by ps.position asc
  limit 1;

  execute format(
    'insert into public.%I (%s, stage_id) '
    'select %s, $2 from public.%I where id = $1',
    p_target, v_shared_cols, v_shared_cols, p_source
  )
  using p_deal_id, v_target_stage_id;

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

  execute format('delete from public.%I where id = $1', p_source)
    using p_deal_id;
end;
$$;

grant execute on function public.move_deal_between_pipelines(uuid, text, text) to authenticated;

-- Drop the checklist tables (items first — it FKs to checklists).
drop table if exists public.underwriting_checklist_items;
drop table if exists public.underwriting_checklists;
