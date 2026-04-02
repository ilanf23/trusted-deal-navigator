import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMember } from '@/hooks/useTeamMember';

// ── Types ──

interface FeedComment {
  id: string;
  activity_id: string;
  lead_id: string | null;
  content: string;
  created_by: string | null;
  created_at: string;
}

interface FeedReactionRow {
  id: string;
  activity_id: string;
  emoji: string;
  user_id: string;
  user_name: string | null;
  created_at: string;
}

export interface AggregatedReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  users: string[];
}

// ── Comments ──

export function useFeedComments(activityId: string, enabled: boolean) {
  return useQuery<FeedComment[]>({
    queryKey: ['feed-comments', activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feed_comments')
        .select('*')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled,
    staleTime: 10_000,
  });
}

export function useAddFeedComment() {
  const queryClient = useQueryClient();
  const { teamMember } = useTeamMember();

  return useMutation({
    mutationFn: async ({ activityId, leadId, content }: { activityId: string; leadId: string | null; content: string }) => {
      const { error } = await supabase
        .from('feed_comments')
        .insert({
          activity_id: activityId,
          lead_id: leadId,
          content,
          created_by: teamMember?.name ?? null,
        });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['feed-comments', vars.activityId] });
    },
  });
}

// ── Reactions ──

export function useFeedReactions(activityId: string) {
  return useQuery<AggregatedReaction[]>({
    queryKey: ['feed-reactions', activityId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const myId = user?.id;

      const { data, error } = await supabase
        .from('feed_reactions')
        .select('*')
        .eq('activity_id', activityId);
      if (error) throw error;

      const rows: FeedReactionRow[] = data || [];
      const map = new Map<string, { count: number; reactedByMe: boolean; users: string[] }>();

      for (const row of rows) {
        const existing = map.get(row.emoji) || { count: 0, reactedByMe: false, users: [] };
        existing.count++;
        if (row.user_id === myId) existing.reactedByMe = true;
        if (row.user_name) existing.users.push(row.user_name);
        map.set(row.emoji, existing);
      }

      return Array.from(map.entries()).map(([emoji, info]) => ({
        emoji,
        count: info.count,
        reactedByMe: info.reactedByMe,
        users: info.users,
      }));
    },
    staleTime: 30_000,
  });
}

export function useToggleFeedReaction() {
  const queryClient = useQueryClient();
  const { teamMember } = useTeamMember();

  return useMutation({
    mutationFn: async ({ activityId, emoji }: { activityId: string; emoji: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if reaction exists
      const { data: existing } = await supabase
        .from('feed_reactions')
        .select('id')
        .eq('activity_id', activityId)
        .eq('emoji', emoji)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('feed_reactions')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('feed_reactions')
          .insert({
            activity_id: activityId,
            emoji,
            user_id: user.id,
            user_name: teamMember?.name ?? null,
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['feed-reactions', vars.activityId] });
    },
  });
}
