import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Resolves a team member's UUID from their display name.
 * Cached for 10 minutes via TanStack Query.
 */
export const useTeamMemberByName = (name: string) => {
  return useQuery({
    queryKey: ['team-member-by-name', name.toLowerCase()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .ilike('name', name)
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10,
    enabled: !!name,
  });
};
