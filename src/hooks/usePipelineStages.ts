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
