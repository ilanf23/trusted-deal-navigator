import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AIChange {
  id: string;
  conversation_id: string | null;
  user_id: string;
  team_member_id: string | null;
  mode: 'assist' | 'agent';
  target_table: string;
  target_id: string;
  operation: 'insert' | 'update' | 'delete';
  old_values: Record<string, any> | null;
  new_values: Record<string, any>;
  description: string;
  ai_reasoning: string | null;
  status: 'applied' | 'undone' | 'redone' | 'failed';
  undone_at: string | null;
  undone_by: string | null;
  batch_id: string | null;
  batch_order: number;
  created_at: string;
  model_used: string | null;
  team_member?: { name: string; avatar_url: string | null } | null;
}

export interface AIBatch {
  id: string;
  conversation_id: string | null;
  user_id: string;
  mode: 'assist' | 'agent';
  prompt_summary: string | null;
  total_changes: number;
  status: 'applied' | 'partially_undone' | 'fully_undone';
  created_at: string;
}

interface UseAIChangesFilters {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  mode?: 'assist' | 'agent';
  status?: 'applied' | 'undone' | 'redone' | 'failed';
  targetTable?: string;
}

export const useAIChanges = (filters?: UseAIChangesFilters) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ai-agent-changes', filters],
    queryFn: async () => {
      let q = supabase
        .from('ai_agent_changes' as any)
        .select('*, team_member:team_members(name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters?.dateFrom) {
        q = q.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        q = q.lte('created_at', filters.dateTo);
      }
      if (filters?.userId) {
        q = q.eq('user_id', filters.userId);
      }
      if (filters?.mode) {
        q = q.eq('mode', filters.mode);
      }
      if (filters?.status) {
        q = q.eq('status', filters.status);
      }
      if (filters?.targetTable) {
        // Match both new and legacy table names for historical records
        const tableNameMap: Record<string, string[]> = {
          tasks: ['tasks', 'evan_tasks'],
          notes: ['notes', 'evan_notes'],
          communications: ['communications', 'evan_communications'],
        };
        const names = tableNameMap[filters.targetTable] || [filters.targetTable];
        q = q.in('target_table', names);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as AIChange[];
    },
  });

  const batchesQuery = useQuery({
    queryKey: ['ai-agent-batches', filters],
    queryFn: async () => {
      let q = supabase
        .from('ai_agent_batches' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filters?.mode) {
        q = q.eq('mode', filters.mode);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as AIBatch[];
    },
  });

  const undoChange = async (changeId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evan-ai-assistant`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'undo', changeId }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Undo failed');
    }

    queryClient.invalidateQueries({ queryKey: ['ai-agent-changes'] });
    queryClient.invalidateQueries({ queryKey: ['ai-agent-batches'] });
  };

  const redoChange = async (changeId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evan-ai-assistant`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'redo', changeId }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Redo failed');
    }

    queryClient.invalidateQueries({ queryKey: ['ai-agent-changes'] });
    queryClient.invalidateQueries({ queryKey: ['ai-agent-batches'] });
  };

  const undoBatch = async (batchId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evan-ai-assistant`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'undo_batch', batchId }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Batch undo failed');
    }

    queryClient.invalidateQueries({ queryKey: ['ai-agent-changes'] });
    queryClient.invalidateQueries({ queryKey: ['ai-agent-batches'] });
  };

  return {
    changes: query.data || [],
    batches: batchesQuery.data || [],
    isLoading: query.isLoading,
    isBatchesLoading: batchesQuery.isLoading,
    error: query.error,
    undoChange,
    redoChange,
    undoBatch,
    refetch: () => {
      query.refetch();
      batchesQuery.refetch();
    },
  };
};
