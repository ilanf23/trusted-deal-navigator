import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface ScoreDealResult {
  success: true;
  winPercentage: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  signals: Record<string, unknown>;
}

interface ScoreDealError {
  status: number;
  message: string;
}

function parseEdgeError(err: unknown): ScoreDealError {
  // supabase.functions.invoke surfaces non-2xx responses via err.context.response
  // and the parsed JSON body via err.context.json (newer SDKs).
  // Fall back to Error.message for everything else.
  if (err && typeof err === 'object') {
    const e = err as { context?: { status?: number; json?: { error?: string } }; message?: string };
    const status = e.context?.status ?? 0;
    const message = e.context?.json?.error ?? e.message ?? 'Unknown error';
    return { status, message };
  }
  return { status: 0, message: 'Unknown error' };
}

/**
 * Mutation hook that calls the score-deal-win-percentage edge function and
 * surfaces toast feedback. On success, the mutation invalidates the deal's
 * cached data so the displayed win percentage refreshes from the DB.
 */
export function useScoreDealWithAI(leadId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<ScoreDealResult, unknown, void>({
    mutationFn: async () => {
      if (!leadId) throw new Error('Missing leadId');
      const { data, error } = await supabase.functions.invoke('score-deal-win-percentage', {
        body: { leadId },
      });
      if (error) throw error;
      return data as ScoreDealResult;
    },
    onSuccess: (data) => {
      toast.success(`AI win % updated to ${data.winPercentage}%`);
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: ['pipeline-lead-expanded', leadId] });
        queryClient.invalidateQueries({ queryKey: ['ai-win-score-reasoning', leadId] });
      }
      queryClient.invalidateQueries({ queryKey: ['potential-deals'] });
    },
    onError: (err) => {
      const { status, message } = parseEdgeError(err);
      if (status === 429) {
        toast.error('Scoring rate limit reached, try again in a minute');
      } else if (status === 402) {
        toast.error('AI credits exhausted');
      } else {
        toast.error(message || 'Failed to score deal');
      }
    },
  });
}

export interface LatestWinScoreReasoning {
  ai_reasoning: string | null;
  created_at: string;
  new_values: { win_percentage?: number } | null;
}

/**
 * Query hook that fetches the most recent AI win-score audit row for a lead.
 * Used to render the reasoning popover next to the Win Percentage field.
 */
export function useLatestWinScoreReasoning(leadId: string | undefined) {
  return useQuery<LatestWinScoreReasoning | null>({
    queryKey: ['ai-win-score-reasoning', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_changes')
        .select('ai_reasoning, created_at, new_values')
        .eq('target_table', 'potential')
        .eq('target_id', leadId!)
        .ilike('description', '%AI scored deal%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as LatestWinScoreReasoning | null;
    },
    staleTime: 30_000,
  });
}
