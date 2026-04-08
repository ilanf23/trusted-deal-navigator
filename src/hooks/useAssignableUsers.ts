import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AssignableUser {
  id: string;
  name: string;
  email: string | null;
  position: string | null;
  avatar_url: string | null;
}

/**
 * Users that can be assigned as owners/assignees on leads, deals,
 * projects, companies, etc. Driven by users.is_assignable.
 * To change who appears here, update the DB — not this code.
 */
export const useAssignableUsers = () => {
  return useQuery({
    queryKey: ['assignable-users'],
    queryFn: async (): Promise<AssignableUser[]> => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, position, avatar_url')
        .eq('is_assignable', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
};
