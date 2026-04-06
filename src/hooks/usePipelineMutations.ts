import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { EntityType } from '@/integrations/supabase/types';

type CrmTable = 'pipeline' | 'underwriting' | 'lender_management';

const QUERY_KEY_MAP: Record<CrmTable, string> = {
  pipeline: 'pipeline-deals',
  underwriting: 'underwriting-deals',
  lender_management: 'lender-management-deals',
};

async function updateDealStage(table: CrmTable, dealId: string, newStageId: string) {
  const updateData = { stage_id: newStageId, updated_at: new Date().toISOString() };
  if (table === 'pipeline') {
    return supabase.from('pipeline').update(updateData).eq('id', dealId);
  } else if (table === 'underwriting') {
    return supabase.from('underwriting').update(updateData).eq('id', dealId);
  } else {
    return supabase.from('lender_management').update(updateData).eq('id', dealId);
  }
}

async function insertDeal(table: CrmTable, data: Record<string, unknown>) {
  if (table === 'pipeline') {
    return supabase.from('pipeline').insert(data as any).select().single();
  } else if (table === 'underwriting') {
    return supabase.from('underwriting').insert(data as any).select().single();
  } else {
    return supabase.from('lender_management').insert(data as any).select().single();
  }
}

async function deleteDeal(table: CrmTable, dealId: string) {
  if (table === 'pipeline') {
    return supabase.from('pipeline').delete().eq('id', dealId);
  } else if (table === 'underwriting') {
    return supabase.from('underwriting').delete().eq('id', dealId);
  } else {
    return supabase.from('lender_management').delete().eq('id', dealId);
  }
}

async function bulkDeleteDeals(table: CrmTable, dealIds: string[]) {
  if (table === 'pipeline') {
    return supabase.from('pipeline').delete().in('id', dealIds);
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
          entity_type: table as EntityType,
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
export const usePipelineMutations = (_pipelineId?: string) => useCrmMutations('pipeline');
