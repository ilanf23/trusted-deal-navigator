import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface EmailThread {
  id: string;
  thread_id: string;
  lead_id: string | null;
  subject: string | null;
  last_message_date: string | null;
  next_action: string | null;
  waiting_on: 'borrower' | 'lender' | 'internal' | 'none' | null;
  is_triaged: boolean;
  assigned_to: string | null;
  sla_breached: boolean;
  last_outbound_date: string | null;
  created_at: string;
  updated_at: string;
  lead?: {
    id: string;
    name: string;
    company_name: string | null;
    status: string;
  } | null;
}

export function useEmailThreads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all email threads with lead info
  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['email-threads', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('email_threads')
        .select(`
          *,
          lead:leads(id, name, company_name, status)
        `)
        .order('last_message_date', { ascending: false });
      
      if (error) throw error;
      return data as EmailThread[];
    },
    enabled: !!user?.id,
  });

  // Create a map for quick lookup by thread_id
  const threadMap = new Map<string, EmailThread>();
  threads.forEach(thread => {
    threadMap.set(thread.thread_id, thread);
  });

  // Upsert thread mutation
  const upsertThread = useMutation({
    mutationFn: async ({
      threadId,
      updates,
    }: {
      threadId: string;
      updates: Partial<Omit<EmailThread, 'id' | 'thread_id' | 'created_at' | 'updated_at'>>;
    }) => {
      const existing = threadMap.get(threadId);
      
      if (existing) {
        const { error } = await supabase
          .from('email_threads')
          .update(updates)
          .eq('thread_id', threadId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_threads')
          .insert({
            thread_id: threadId,
            ...updates,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    },
  });

  // Link deal to thread
  const linkDeal = useMutation({
    mutationFn: async ({ threadId, leadId, subject }: { threadId: string; leadId: string | null; subject?: string }) => {
      const existing = threadMap.get(threadId);
      
      if (existing) {
        const { error } = await supabase
          .from('email_threads')
          .update({ 
            lead_id: leadId,
            is_triaged: !!leadId,
          })
          .eq('thread_id', threadId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_threads')
          .insert({
            thread_id: threadId,
            lead_id: leadId,
            subject: subject || null,
            is_triaged: !!leadId,
            last_message_date: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      if (leadId) {
        toast.success('Deal linked');
      } else {
        toast.success('Deal unlinked');
      }
    },
    onError: (error: any) => {
      toast.error('Failed to link deal: ' + error.message);
    },
  });

  // Set next action
  const setNextAction = useMutation({
    mutationFn: async ({ threadId, nextAction, subject }: { threadId: string; nextAction: string | null; subject?: string }) => {
      const existing = threadMap.get(threadId);
      
      if (existing) {
        const { error } = await supabase
          .from('email_threads')
          .update({ 
            next_action: nextAction,
            is_triaged: existing.lead_id ? !!nextAction : false,
          })
          .eq('thread_id', threadId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_threads')
          .insert({
            thread_id: threadId,
            next_action: nextAction,
            subject: subject || null,
            is_triaged: false,
            last_message_date: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      toast.success('Next step updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  // Set waiting on status
  const setWaitingOn = useMutation({
    mutationFn: async ({ 
      threadId, 
      waitingOn,
      subject 
    }: { 
      threadId: string; 
      waitingOn: 'borrower' | 'lender' | 'internal' | 'none' | null;
      subject?: string;
    }) => {
      const existing = threadMap.get(threadId);
      
      if (existing) {
        const { error } = await supabase
          .from('email_threads')
          .update({ waiting_on: waitingOn })
          .eq('thread_id', threadId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_threads')
          .insert({
            thread_id: threadId,
            waiting_on: waitingOn,
            subject: subject || null,
            last_message_date: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, { waitingOn }) => {
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      if (waitingOn && waitingOn !== 'none') {
        toast.success(`Marked as waiting on ${waitingOn}`);
      } else {
        toast.success('Status cleared');
      }
    },
    onError: (error: any) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  // Mark thread as complete/resolved
  const markComplete = useMutation({
    mutationFn: async ({ threadId }: { threadId: string }) => {
      const { error } = await supabase
        .from('email_threads')
        .update({ 
          waiting_on: 'none',
          next_action: null,
          is_triaged: true,
        })
        .eq('thread_id', threadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
      toast.success('Marked as complete');
    },
  });

  // Get counts for sidebar
  const counts = {
    untriaged: threads.filter(t => !t.is_triaged || (!t.lead_id && !t.next_action)).length,
    waitingOnBorrower: threads.filter(t => t.waiting_on === 'borrower').length,
    waitingOnLender: threads.filter(t => t.waiting_on === 'lender').length,
    internal: threads.filter(t => t.waiting_on === 'internal').length,
    slaBreached: threads.filter(t => t.sla_breached).length,
  };

  return {
    threads,
    threadMap,
    isLoading,
    counts,
    linkDeal,
    setNextAction,
    setWaitingOn,
    markComplete,
    upsertThread,
    getThread: (threadId: string) => threadMap.get(threadId),
  };
}
