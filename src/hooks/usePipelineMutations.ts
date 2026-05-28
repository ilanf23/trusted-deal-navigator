import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { EntityType } from '@/integrations/supabase/types';

export type CrmTable = 'potential' | 'underwriting' | 'lender_management';

export const QUERY_KEY_MAP: Record<CrmTable, string> = {
  potential: 'potential-deals',
  underwriting: 'underwriting-deals',
  lender_management: 'lender-management-deals',
};

export const PIPELINE_LABELS: Record<CrmTable, string> = {
  potential: 'Potential',
  underwriting: 'Underwriting',
  lender_management: 'Lender Management',
};

export async function moveDealBetweenPipelines(
  dealId: string,
  source: CrmTable,
  target: CrmTable,
): Promise<void> {
  if (source === target) return;
  // Single-table model (#97): moving a deal is a one-field pipeline update plus
  // re-seeding stage_id to the first stage of the target system pipeline. The
  // old move_deal_between_pipelines RPC (which copied rows between tables) is gone.
  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('id, pipelines!inner(name, is_system)')
    .eq('pipelines.name', PIPELINE_LABELS[target])
    .eq('pipelines.is_system', true)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from('deals')
    .update({ pipeline: target, stage_id: (stage as { id?: string } | null)?.id ?? null })
    .eq('id', dealId);
  if (error) throw error;
}

// Every deal — regardless of pipeline — uses a single polymorphic discriminator.
const ENTITY_TYPE_MAP: Record<CrmTable, EntityType> = {
  potential: 'deal',
  underwriting: 'deal',
  lender_management: 'deal',
};

async function updateDealStage(_pipeline: CrmTable, dealId: string, newStageId: string) {
  const updateData = { stage_id: newStageId, updated_at: new Date().toISOString() };
  return supabase.from('deals').update(updateData).eq('id', dealId);
}

async function insertDeal(pipeline: CrmTable, data: Record<string, unknown>) {
  return supabase.from('deals').insert({ ...data, pipeline } as any).select().single();
}

async function selectDealById(_pipeline: CrmTable, dealId: string) {
  return supabase.from('deals').select('*').eq('id', dealId).single();
}

async function deleteDeal(_pipeline: CrmTable, dealId: string) {
  return supabase.from('deals').delete().eq('id', dealId);
}

async function bulkDeleteDeals(_pipeline: CrmTable, dealIds: string[]) {
  return supabase.from('deals').delete().in('id', dealIds);
}

export const useCrmMutations = (table: CrmTable) => {
  const queryClient = useQueryClient();
  const queryKey = QUERY_KEY_MAP[table];

  const moveLeadToStage = useMutation({
    mutationFn: async ({ pipelineLeadId, newStageId, newStageName, oldStageName }: {
      pipelineLeadId: string;
      newStageId: string;
      newStageName?: string;
      oldStageName?: string;
      leadId?: string;
    }) => {
      // pipelineLeadId IS the deal ID in the new schema
      const dealId = pipelineLeadId;
      const { error } = await updateDealStage(table, dealId, newStageId);
      if (error) throw error;

      // Best-effort activity log. The `activities` RLS policy currently
      // requires app_role = 'admin', so super_admin users get blocked here.
      // Do not fail the stage move when the audit-log write is rejected.
      // (A BEFORE UPDATE trigger also writes a stage_change row via
      // SECURITY DEFINER, so audit history is preserved either way.)
      if (dealId && oldStageName && newStageName) {
        try {
          const { error: activityError } = await supabase.from('activities').insert({
            entity_id: dealId,
            entity_type: ENTITY_TYPE_MAP[table],
            activity_type: 'stage_change',
            title: `Moved from ${oldStageName} to ${newStageName}`,
            content: JSON.stringify({ from: oldStageName, to: newStageName }),
          });
          if (activityError) {
            console.warn('Skipped stage_change activity log:', activityError);
          }
        } catch (err) {
          console.warn('Skipped stage_change activity log:', err);
        }
      }
    },
    // Optimistic update: move the card into its new column immediately so the
    // UI doesn't visibly snap back while the round-trip is in flight.
    onMutate: async ({ pipelineLeadId, newStageId }) => {
      await queryClient.cancelQueries({ queryKey: [queryKey] });
      const previous = queryClient.getQueryData<unknown[]>([queryKey]);
      queryClient.setQueryData<unknown[] | undefined>([queryKey], (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((row) => {
          const r = row as { id?: string; stage_id?: string; stage?: { id?: string } | null };
          if (r?.id !== pipelineLeadId) return row;
          return {
            ...r,
            stage_id: newStageId,
            stage: r.stage ? { ...r.stage, id: newStageId } : r.stage,
          };
        });
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData([queryKey], context.previous);
      }
      toast.error('Failed to move deal');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ['lead-activity-timeline'] });
    },
    onSuccess: () => {
      toast.success('Deal moved successfully');
    },
  });

  const addLeadToPipeline = useMutation({
    mutationFn: async ({ leadData, stageId }: {
      leadData: {
        // Required
        name: string;
        // Deal
        opportunity_name?: string | null;
        loan_stage?: string | null;
        clx_file_name?: string | null;
        waiting_on?: string | null;
        tags?: string[] | null;
        deal_value?: number | null;
        description?: string | null;
        // Primary contact
        title?: string | null;
        email?: string | null;
        phone?: string | null;
        // Status & ownership
        close_date?: string | null;
        assigned_to?: string | null;
        source?: string | null;
        priority?: string | null;
        // Scoring
        win_percentage?: number | null;
        loss_reason?: string | null;
        // Additional
        visibility?: string | null;
        bank_relationships?: string | null;
        client_other_lenders?: boolean;
        flagged_for_weekly?: boolean;
      };
      stageId: string;
    }) => {
      // Build the insert payload — only include keys the caller provided so the DB
      // uses its own defaults for anything omitted. `name` is required; everything else
      // is optional and written as-is (null-coerced) when present.
      const payload: Record<string, unknown> = {
        name: leadData.name,
        stage_id: stageId,
        status: 'initial_review',
      };
      const passthrough: Array<keyof typeof leadData> = [
        'opportunity_name',
        'loan_stage',
        'clx_file_name',
        'waiting_on',
        'tags',
        'deal_value',
        'description',
        'title',
        'email',
        'phone',
        'close_date',
        'assigned_to',
        'source',
        'priority',
        'win_percentage',
        'loss_reason',
        'visibility',
        'bank_relationships',
        'client_other_lenders',
        'flagged_for_weekly',
      ];
      for (const key of passthrough) {
        if (leadData[key] !== undefined) {
          payload[key] = leadData[key];
        }
      }

      const { data, error } = await insertDeal(table, payload);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: () => {
      toast.error('Failed to create opportunity');
    },
  });

  const duplicateDealForSamePerson = useMutation({
    mutationFn: async ({ sourceId, dealOverrides, newOwnerId }: {
      sourceId: string;
      dealOverrides: {
        opportunity_name?: string | null;
        deal_value?: number | null;
        description?: string | null;
        close_date?: string | null;
        stage_id: string;
      };
      newOwnerId: string | null;
    }) => {
      // 1. Fetch source row
      const { data: source, error: srcErr } = await selectDealById(table, sourceId);
      if (srcErr) throw srcErr;
      if (!source) throw new Error('Source opportunity not found');

      // 2. Build insert payload — identity fields only, plus deal overrides.
      // Everything else falls back to DB defaults (nulls / DB-generated).
      // The three pipeline tables share these identity columns; potential also
      // has prospect-only social fields, handled below.
      const sourceRow = source as Record<string, unknown>;
      const insertPayload: Record<string, unknown> = {
        // Identity (common to potential / underwriting / lender_management)
        name: sourceRow.name,
        company_name: sourceRow.company_name ?? null,
        email: sourceRow.email ?? null,
        phone: sourceRow.phone ?? null,
        title: sourceRow.title ?? null,
        known_as: sourceRow.known_as ?? null,
        // Deal overrides from the dialog
        opportunity_name: dealOverrides.opportunity_name ?? null,
        deal_value: dealOverrides.deal_value ?? null,
        description: dealOverrides.description ?? null,
        close_date: dealOverrides.close_date ?? null,
        stage_id: dealOverrides.stage_id,
        status: 'initial_review',
        // Owner = current user (per product decision; do not inherit source owner)
        assigned_to: newOwnerId,
      };

      // Prospect-only identity columns (only `potential` has these)
      if (table === 'potential') {
        insertPayload.linkedin = sourceRow.linkedin ?? null;
        insertPayload.twitter = sourceRow.twitter ?? null;
        insertPayload.website = sourceRow.website ?? null;
        insertPayload.work_website = sourceRow.work_website ?? null;
      }

      // 3. Insert the new opportunity
      const { data: newDeal, error: insErr } = await insertDeal(table, insertPayload);
      if (insErr) throw insErr;
      if (!newDeal) throw new Error('Insert returned no row');

      // 4. Best-effort copy of contact satellite rows. If any of these fails we
      // still consider the duplication a success — the new opportunity exists,
      // and the user will see a soft warning so they can re-add manually.
      let satelliteWarning = false;
      try {
        const entityTypeValue = ENTITY_TYPE_MAP[table];
        const newId = (newDeal as { id: string }).id;

        const [emailsRes, phonesRes, addressesRes] = await Promise.all([
          supabase
            .from('entity_emails')
            .select('email, email_type, is_primary')
            .eq('entity_id', sourceId)
            .eq('entity_type', entityTypeValue),
          supabase
            .from('entity_phones')
            .select('phone_number, phone_type, is_primary')
            .eq('entity_id', sourceId)
            .eq('entity_type', entityTypeValue),
          supabase
            .from('entity_addresses')
            .select('address_line_1, address_line_2, address_type, city, state, zip_code, country, is_primary')
            .eq('entity_id', sourceId)
            .eq('entity_type', entityTypeValue),
        ]);

        if (emailsRes.error) throw emailsRes.error;
        if (phonesRes.error) throw phonesRes.error;
        if (addressesRes.error) throw addressesRes.error;

        if (emailsRes.data && emailsRes.data.length > 0) {
          const { error } = await supabase.from('entity_emails').insert(
            emailsRes.data.map((e) => ({ ...e, entity_id: newId, entity_type: entityTypeValue })),
          );
          if (error) throw error;
        }
        if (phonesRes.data && phonesRes.data.length > 0) {
          const { error } = await supabase.from('entity_phones').insert(
            phonesRes.data.map((p) => ({ ...p, entity_id: newId, entity_type: entityTypeValue })),
          );
          if (error) throw error;
        }
        if (addressesRes.data && addressesRes.data.length > 0) {
          const { error } = await supabase.from('entity_addresses').insert(
            addressesRes.data.map((a) => ({ ...a, entity_id: newId, entity_type: entityTypeValue })),
          );
          if (error) throw error;
        }
      } catch (err) {
        console.warn('Failed to copy contact satellite rows on duplicate:', err);
        satelliteWarning = true;
      }

      return { newDeal, satelliteWarning };
    },
    onSuccess: ({ satelliteWarning }) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      if (satelliteWarning) {
        toast.warning("Opportunity created, but contact info wasn't fully copied");
      } else {
        toast.success('Opportunity duplicated');
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to duplicate opportunity';
      toast.error(msg);
    },
  });

  const removeLeadFromPipeline = useMutation({
    mutationFn: async (dealId: string) => {
      const { error } = await deleteDeal(table, dealId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success('Deal removed');
    },
    onError: () => {
      toast.error('Failed to remove deal');
    },
  });

  const bulkRemoveLeadsFromPipeline = useMutation({
    mutationFn: async (dealIds: string[]) => {
      const { error } = await bulkDeleteDeals(table, dealIds);
      if (error) throw error;
      return dealIds;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`${ids.length} deal(s) removed`);
    },
    onError: () => {
      toast.error('Failed to remove deals');
    },
  });

  return { moveLeadToStage, addLeadToPipeline, duplicateDealForSamePerson, removeLeadFromPipeline, bulkRemoveLeadsFromPipeline };
};

// Backward compat alias
export const usePipelineMutations = (_pipelineId?: string) => useCrmMutations('potential');
