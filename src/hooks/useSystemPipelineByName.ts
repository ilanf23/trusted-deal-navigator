import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useSystemPipelineByName = (name: string) => {
  return useQuery({
    queryKey: ['pipeline-by-name', name],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pipelines')
        .select('*')
        .eq('name', name)
        .eq('is_system', true)
        .single();
      if (error) throw error;
      return data as { id: string; name: string; is_main: boolean; is_system: boolean; owner_id: string };
    },
    staleTime: Infinity,
  });
};
