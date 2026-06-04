import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { aiAssistantUrl } from '@/lib/aiAssistantRouter';

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
        .from('ai_events' as any)
        .select('id, user_id, parent_id, created_at, payload')
        .eq('event_type', 'agent_change')
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
        q = q.eq('payload->>mode', filters.mode);
      }
      if (filters?.status) {
        q = q.eq('payload->>status', filters.status);
      }
      if (filters?.targetTable) {
        // Match both new and legacy table names for historical records
        const tableNameMap: Record<string, string[]> = {
          tasks: ['tasks', 'evan_tasks'],
          notes: ['notes', 'evan_notes'],
          communications: ['communications', 'evan_communications'],
        };
        const names = tableNameMap[filters.targetTable] || [filters.targetTable];
        q = q.in('payload->>target_table', names);
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as any[];

      // The team_member FK embed is gone (changes live in ai_events.payload now);
      // resolve names/avatars in one follow-up query and merge client-side.
      const memberIds = [...new Set(rows.map(r => r.payload?.team_member_id).filter(Boolean))];
      let memberMap: Record<string, { name: string; avatar_url: string | null }> = {};
      if (memberIds.length > 0) {
        const { data: members } = await supabase
          .from('users')
          .select('id, name, avatar_url')
          .in('id', memberIds as string[]);
        memberMap = Object.fromEntries(
          (members ?? []).map((m: any) => [m.id, { name: m.name, avatar_url: m.avatar_url }]),
        );
      }

      return rows.map((r): AIChange => {
        const p = r.payload ?? {};
        return {
          id: r.id,
          conversation_id: p.conversation_id ?? null,
          user_id: r.user_id,
          team_member_id: p.team_member_id ?? null,
          mode: p.mode,
          target_table: p.target_table,
          target_id: p.target_id,
          operation: p.operation,
          old_values: p.old_values ?? null,
          new_values: p.new_values,
          description: p.description,
          ai_reasoning: p.ai_reasoning ?? null,
          status: p.status,
          undone_at: p.undone_at ?? null,
          undone_by: p.undone_by ?? null,
          batch_id: r.parent_id ?? null,
          batch_order: p.batch_order ?? 0,
          created_at: r.created_at,
          model_used: p.model_used ?? null,
          team_member: p.team_member_id ? (memberMap[p.team_member_id] ?? null) : null,
        };
      });
    },
  });

  const batchesQuery = useQuery({
    queryKey: ['ai-agent-batches', filters],
    queryFn: async () => {
      let q = supabase
        .from('ai_events' as any)
        .select('id, user_id, parent_id, created_at, payload')
        .eq('event_type', 'agent_batch')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filters?.mode) {
        q = q.eq('payload->>mode', filters.mode);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r: any): AIBatch => {
        const p = r.payload ?? {};
        return {
          id: r.id,
          conversation_id: r.parent_id ?? null,
          user_id: r.user_id,
          mode: p.mode,
          prompt_summary: p.prompt_summary ?? null,
          total_changes: p.total_changes ?? 0,
          status: p.status,
          created_at: r.created_at,
        };
      });
    },
  });

  const undoChange = async (changeId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const requestBody = { action: 'undo', changeId };
    const response = await fetch(
      aiAssistantUrl(requestBody),
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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

    const requestBody = { action: 'redo', changeId };
    const response = await fetch(
      aiAssistantUrl(requestBody),
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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

    const requestBody = { action: 'undo_batch', batchId };
    const response = await fetch(
      aiAssistantUrl(requestBody),
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
