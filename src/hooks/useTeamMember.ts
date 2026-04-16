import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  position: string | null;
  is_owner: boolean;
  avatar_url: string | null;
}

export const useTeamMember = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: teamMember, isLoading, isFetched } = useQuery({
    queryKey: ['team-member', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Run RPC and avatar fetch in parallel — auth uid === users.id in the consolidated users table
      const [rpcResult, avatarResult] = await Promise.all([
        supabase.rpc('get_current_team_member'),
        supabase.from('users').select('avatar_url').eq('id', user.id).maybeSingle(),
      ]);

      if (rpcResult.error || !rpcResult.data || rpcResult.data.length === 0) {
        console.error('Error fetching team member:', rpcResult.error);
        return null;
      }

      const basicInfo = rpcResult.data[0];

      return {
        ...basicInfo,
        avatar_url: avatarResult.data?.avatar_url || null,
      } as TeamMember;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const loading = isLoading || (!!user && !isFetched);
  const isOwner = teamMember?.is_owner ?? false;
  const canAccessDashboard = (employeeName: string) => {
    if (!teamMember) return false;
    if (isOwner) return true;
    return teamMember.name.toLowerCase() === employeeName.toLowerCase();
  };

  return {
    teamMember: teamMember ?? null,
    loading,
    isOwner,
    canAccessDashboard,
  };
};
