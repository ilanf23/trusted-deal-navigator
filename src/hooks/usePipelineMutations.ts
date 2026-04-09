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

  return { moveLeadToStage, addLeadToPipeline, removeLeadFromPipeline, bulkRemoveLeadsFromPipeline };
};

// Backward compat alias
export const usePipelineMutations = (_pipelineId?: string) => useCrmMutations('potential');
