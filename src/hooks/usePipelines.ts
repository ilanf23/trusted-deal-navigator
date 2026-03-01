import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const usePipelines = () => {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pipelines')
        .select('*')
        .order('is_main', { ascending: false })
        .order('name');
      if (error) throw error;
      return data as any[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useSystemPipelines = () => {
  return useQuery({
    queryKey: ['pipelines', 'system'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pipelines')
        .select('*')
        .eq('is_system', true)
        .order('is_main', { ascending: false })
        .order('name');
      if (error) throw error;
      return data as any[];
    },
    staleTime: 5 * 60 * 1000,
  });
};
