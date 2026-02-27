import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const usePipelineLeads = (pipelineId: string | undefined) => {
  return useQuery({
    queryKey: ['pipeline-leads', pipelineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_leads')
        .select('*, lead:leads(*), stage:pipeline_stages(*)')
        .eq('pipeline_id', pipelineId!)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!pipelineId,
  });
};
