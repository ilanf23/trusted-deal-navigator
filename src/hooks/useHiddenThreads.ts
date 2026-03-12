import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HiddenThread {
  id: string;
  thread_id: string;
  hidden_by: string;
}

export function useHiddenThreads(teamMemberId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: hiddenThreads = [] } = useQuery({
    queryKey: ['hidden-email-threads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hidden_email_threads')
        .select('id, thread_id, hidden_by');
      if (error) throw error;
      return (data || []) as HiddenThread[];
    },
    enabled: !!teamMemberId,
  });

  const myHiddenIds = new Set(
    hiddenThreads
      .filter((h) => h.hidden_by === teamMemberId)
      .map((h) => h.thread_id)
  );

  const hideMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase
        .from('hidden_email_threads')
        .insert({ thread_id: threadId, hidden_by: teamMemberId! });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hidden-email-threads'] });
      toast.success('Thread hidden from others');
    },
    onError: () => toast.error('Failed to hide thread'),
  });

  const unhideMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase
        .from('hidden_email_threads')
        .delete()
        .eq('thread_id', threadId)
        .eq('hidden_by', teamMemberId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hidden-email-threads'] });
      toast.success('Thread visible to all');
    },
    onError: () => toast.error('Failed to unhide thread'),
  });

  return {
    isHiddenByMe: (threadId: string) => myHiddenIds.has(threadId),
    hideThread: (threadId: string) => hideMutation.mutate(threadId),
    unhideThread: (threadId: string) => unhideMutation.mutate(threadId),
  };
}
