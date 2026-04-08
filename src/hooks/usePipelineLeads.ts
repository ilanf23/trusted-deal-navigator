import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PipelineDeal, UnderwritingDeal, LenderManagementDeal } from '@/integrations/supabase/types';

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

export const usePipelineDeals = () => {
  const query = useQuery({
    queryKey: ['potential-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('*, stage:pipeline_stages(*)')
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

export const useUnderwritingDeals = () => {
  const query = useQuery({
    queryKey: ['underwriting-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('underwriting')
        .select('*, stage:pipeline_stages(*)')
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
        .from('lender_management')
        .select('*, stage:pipeline_stages(*)')
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
