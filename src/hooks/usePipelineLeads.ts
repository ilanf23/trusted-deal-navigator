import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];

export interface PipelineLeadRow {
  id: string;
  pipeline_id: string;
  lead_id: string;
  stage_id: string;
  added_at: string;
  updated_at: string;
  lead: Lead;
  stage: { id: string; name: string; position: number; color: string | null; pipeline_id: string };
}

export const usePipelineLeads = (pipelineId: string | undefined) => {
  const query = useQuery({
    queryKey: ['pipeline-leads', pipelineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_leads')
        .select('*, lead:leads(*), stage:pipeline_stages(*)')
        .eq('pipeline_id', pipelineId!)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as PipelineLeadRow[];
    },
    enabled: !!pipelineId,
  });

  // Flattened leads with stage info attached
  const leads = useMemo(() => {
    if (!query.data) return [];
    return query.data.map(pl => ({
      ...pl.lead,
      _pipelineLeadId: pl.id,
      _stageId: pl.stage_id,
      _stageName: pl.stage?.name ?? '',
      _stagePosition: pl.stage?.position ?? 0,
    }));
  }, [query.data]);

  // Grouped by stage ID for kanban view
  const leadsByStage = useMemo(() => {
    const grouped: Record<string, typeof leads> = {};
    for (const lead of leads) {
      if (!grouped[lead._stageId]) grouped[lead._stageId] = [];
      grouped[lead._stageId].push(lead);
    }
    return grouped;
  }, [leads]);

  return { ...query, leads, leadsByStage };
};

export type FlatPipelineLead = ReturnType<typeof usePipelineLeads>['leads'][number];
