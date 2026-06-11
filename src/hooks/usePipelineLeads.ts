import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database, PipelineDeal, UnderwritingDeal, LenderManagementDeal } from '@/integrations/supabase/types';

interface StageInfo {
  id: string;
  name: string;
  position: number;
  color: string | null;
  pipeline_id: string;
}

function flattenDeal<T extends { id: string; stage_id: string | null }>(
  row: T & { stage: StageInfo | null }
) {
  return {
    ...row,
    _pipelineLeadId: row.id,
    _stageId: row.stage_id ?? '',
    _stageName: row.stage?.name ?? '',
    _stagePosition: row.stage?.position ?? 0,
  };
}

function groupByStage<T extends { _stageId: string }>(items: T[]) {
  const grouped: Record<string, T[]> = {};
  for (const item of items) {
    if (!grouped[item._stageId]) grouped[item._stageId] = [];
    grouped[item._stageId].push(item);
  }
  return grouped;
}

// Columns actually consumed by the Potential board/table (Potential.tsx),
// kanban cards, search/filters and the right-hand PipelineDetailPanel.
// Deliberately excludes heavy unused columns (history, about, description,
// custom_fields jsonb, questionnaire/ratewatch/sheets/volume-log fields, …)
// so the first page load transfers far less data per row.
// If you render a new deals column on the Potential page, add it here.
const POTENTIAL_BOARD_COLUMNS = [
  'id', 'name', 'email', 'phone', 'company_name', 'status', 'stage_id',
  'source', 'notes', 'assigned_to', 'known_as', 'title', 'contact_type',
  'tags', 'website', 'linkedin', 'last_activity_at', 'flagged_for_weekly',
  'uw_number', 'client_other_lenders', 'deal_value', 'bank_relationships',
  'opportunity_name', 'clx_file_name', 'created_at', 'updated_at',
  'related_id', 'lender_name', 'pipeline',
].join(', ');

type DealRow = Database['public']['Tables']['deals']['Row'];

export const usePipelineDeals = () => {
  const query = useQuery({
    queryKey: ['potential-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(`${POTENTIAL_BOARD_COLUMNS}, stage:pipeline_stages(id, name, position, color, pipeline_id)`)
        .eq('pipeline', 'potential')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      // Cast keeps the downstream shape identical to before the column
      // narrowing; un-selected columns are simply absent at runtime.
      return (data ?? []) as unknown as Array<DealRow & { stage: StageInfo | null }>;
    },
  });

  const leads = useMemo(() => {
    if (!query.data) return [];
    return query.data.map(row => flattenDeal(row as any));
  }, [query.data]);

  const leadsByStage = useMemo(() => groupByStage(leads), [leads]);

  return { ...query, leads, leadsByStage };
};

export const useUnderwritingDeals = () => {
  const query = useQuery({
    queryKey: ['underwriting-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, stage:pipeline_stages(*)')
        .eq('pipeline', 'underwriting')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const leads = useMemo(() => {
    if (!query.data) return [];
    return query.data.map(row => flattenDeal(row as any));
  }, [query.data]);

  const leadsByStage = useMemo(() => groupByStage(leads), [leads]);

  return { ...query, leads, leadsByStage };
};

export const useLenderManagementDeals = () => {
  const query = useQuery({
    queryKey: ['lender-management-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, stage:pipeline_stages(*)')
        .eq('pipeline', 'lender_management')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const leads = useMemo(() => {
    if (!query.data) return [];
    return query.data.map(row => flattenDeal(row as any));
  }, [query.data]);

  const leadsByStage = useMemo(() => groupByStage(leads), [leads]);

  return { ...query, leads, leadsByStage };
};

// Backward compat aliases
export const usePipelineLeads = (_pipelineId?: string) => usePipelineDeals();

export type FlatPipelineLead = ReturnType<typeof usePipelineDeals>['leads'][number];
