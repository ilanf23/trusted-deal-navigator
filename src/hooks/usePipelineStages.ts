import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const usePipelineStages = (pipelineId: string | undefined) => {
  return useQuery({
    queryKey: ['pipeline-stages', pipelineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineId!)
        .order('position');
      if (error) throw error;
      return data;
    },
    enabled: !!pipelineId,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Stages for a *system* pipeline, resolved by pipeline name in a single
 * round trip (inner-joins `pipelines` instead of waiting on a separate
 * pipeline lookup first). Removes a sequential fetch from first page load
 * of the pipeline pages.
 */
export const useSystemPipelineStages = (pipelineName: string) => {
  return useQuery({
    queryKey: ['pipeline-stages', 'system', pipelineName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*, pipeline:pipelines!inner(id, name, is_system)')
        .eq('pipeline.name', pipelineName)
        .eq('pipeline.is_system', true)
        .order('position');
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};
