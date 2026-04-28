import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WorkspaceSettings {
  id: string;
  workspace_name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  default_theme: string | null;
  invite_admins_only: boolean | null;
  default_invite_role: string | null;
  default_google_sync: boolean | null;
}

const FALLBACK: WorkspaceSettings = {
  id: 'default',
  workspace_name: 'Commercial Lending X',
  logo_url: null,
  primary_color: '#3b2778',
  secondary_color: '#eee6f6',
  accent_color: '#ec4899',
  default_theme: 'system',
  invite_admins_only: false,
  default_invite_role: 'admin',
  default_google_sync: true,
};

export const useWorkspaceSettings = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['workspace-settings'],
    queryFn: async (): Promise<WorkspaceSettings> => {
      const { data, error } = await supabase
        .from('workspace_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error || !data) return FALLBACK;
      return data as WorkspaceSettings;
    },
    staleTime: 1000 * 60 * 5,
  });

  return {
    workspace: data ?? FALLBACK,
    isLoading,
  };
};

export const useUpdateWorkspaceSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<WorkspaceSettings>) => {
      const { data: existing } = await supabase
        .from('workspace_settings')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (!existing) {
        const { data, error } = await supabase
          .from('workspace_settings')
          .insert({ workspace_name: 'Commercial Lending X', ...updates })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('workspace_settings')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-settings'] });
    },
  });
};
