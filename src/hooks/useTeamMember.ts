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

      // First get basic team member info from RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_current_team_member');

      if (rpcError || !rpcData || rpcData.length === 0) {
        console.error('Error fetching team member:', rpcError);
        return null;
      }

      const basicInfo = rpcData[0];

      // Then fetch avatar_url from team_members table
      const { data: fullData, error: fullError } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', basicInfo.id)
        .single();

      return {
        ...basicInfo,
        avatar_url: fullData?.avatar_url || null,
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
