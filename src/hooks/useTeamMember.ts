import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  is_owner: boolean;
}

export const useTeamMember = () => {
  const { user } = useAuth();
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeamMember = async () => {
      if (!user) {
        setTeamMember(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .rpc('get_current_team_member');

        if (error) {
          console.error('Error fetching team member:', error);
          setTeamMember(null);
        } else if (data && data.length > 0) {
          setTeamMember(data[0] as TeamMember);
        } else {
          setTeamMember(null);
        }
      } catch (err) {
        console.error('Error:', err);
        setTeamMember(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamMember();
  }, [user]);

  const isOwner = teamMember?.is_owner ?? false;
  const canAccessDashboard = (employeeName: string) => {
    if (!teamMember) return false;
    if (isOwner) return true;
    return teamMember.name.toLowerCase() === employeeName.toLowerCase();
  };

  return {
    teamMember,
    loading,
    isOwner,
    canAccessDashboard,
  };
};
