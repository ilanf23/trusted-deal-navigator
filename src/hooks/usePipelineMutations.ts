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
  // RPC is not in auto-generated types.ts yet — cast until types are regenerated.
  const { error } = await (supabase.rpc as any)('move_deal_between_pipelines', {
    p_deal_id: dealId,
    p_source: source,
    p_target: target,
  });
  if (error) throw error;
}

const ENTITY_TYPE_MAP: Record<CrmTable, EntityType> = {
  potential: 'potential',
  underwriting: 'underwriting',
  lender_management: 'lender_management',
};

async function updateDealStage(table: CrmTable, dealId: string, newStageId: string) {
  const updateData = { stage_id: newStageId, updated_at: new Date().toISOString() };
  if (table === 'potential') {
    return supabase.from('potential').update(updateData).eq('id', dealId);
  } else if (table === 'underwriting') {
    return supabase.from('underwriting').update(updateData).eq('id', dealId);
  } else {
    return supabase.from('lender_management').update(updateData).eq('id', dealId);
  }
}

async function insertDeal(table: CrmTable, data: Record<string, unknown>) {
  if (table === 'potential') {
    return supabase.from('potential').insert(data as any).select().single();
  } else if (table === 'underwriting') {
    return supabase.from('underwriting').insert(data as any).select().single();
  } else {
    return supabase.from('lender_management').insert(data as any).select().single();
  }
}

async function selectDealById(table: CrmTable, dealId: string) {
  if (table === 'potential') {
    return supabase.from('potential').select('*').eq('id', dealId).single();
  } else if (table === 'underwriting') {
    return supabase.from('underwriting').select('*').eq('id', dealId).single();
  } else {
    return supabase.from('lender_management').select('*').eq('id', dealId).single();
  }
}

async function deleteDeal(table: CrmTable, dealId: string) {
  if (table === 'potential') {
    return supabase.from('potential').delete().eq('id', dealId);
  } else if (table === 'underwriting') {
    return supabase.from('underwriting').delete().eq('id', dealId);
  } else {
    return supabase.from('lender_management').delete().eq('id', dealId);
  }
}

async function bulkDeleteDeals(table: CrmTable, dealIds: string[]) {
  if (table === 'potential') {
    return supabase.from('potential').delete().in('id', dealIds);
  } else if (table === 'underwriting') {
    return supabase.from('underwriting').delete().in('id', dealIds);
  } else {
    return supabase.from('lender_management').delete().in('id', dealIds);
  }
}

export const useCrmMutations = (table: CrmTable) => {
  const queryClient = useQueryClient();
  const queryKey = QUERY_KEY_MAP[table];

  const moveLeadToStage = useMutation({
    mutationFn: async ({ pipelineLeadId, newStageId, newStageName, oldStageName, leadId }: {
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

      // Log activity
      if (dealId && oldStageName && newStageName) {
        await supabase.from('activities').insert({
          entity_id: dealId,
          entity_type: ENTITY_TYPE_MAP[table],
          activity_type: 'stage_change',
          title: `Moved from ${oldStageName} to ${newStageName}`,
          content: JSON.stringify({ from: oldStageName, to: newStageName }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ['lead-activity-timeline'] });
      toast.success('Deal moved successfully');
    },
    onError: () => {
      toast.error('Failed to move deal');
    },
  });

  const addLeadToPipeline = useMutation({
    mutationFn: async ({ leadData, stageId }: {
      leadData: { name: string; company_name?: string; email?: string; phone?: string; assigned_to?: string | null };
      stageId: string;
    }) => {
      const { data, error } = await insertDeal(table, {
        name: leadData.name,
        company_name: leadData.company_name || null,
        email: leadData.email || null,
        phone: leadData.phone || null,
        assigned_to: leadData.assigned_to || null,
        stage_id: stageId,
        status: 'initial_review',
      });
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
