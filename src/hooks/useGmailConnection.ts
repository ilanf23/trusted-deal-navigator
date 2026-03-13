import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { GmailEmail, getGmailCallbackUrl } from '@/components/gmail/gmailHelpers';

type FolderQuery = string; // Gmail search query string e.g. 'in:inbox'

interface UseGmailConnectionOptions {
  /** Unique prefix for React Query keys to avoid cache collisions */
  userKey: string;
  /** Callback URL prefix: 'admin' or 'superadmin' */
  callbackPrefix?: 'admin' | 'superadmin';
  /** Max results per folder fetch (default 50) */
  maxResults?: number;
  /** Whether to fetch sender photos */
  fetchPhotos?: boolean;
  /** Return path after OAuth connect */
  returnPath?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function mapMessages(data: any): GmailEmail[] {
  return (data?.messages || []).map((msg: any) => ({
    id: msg.id,
    threadId: msg.threadId,
    subject: msg.subject || '(No Subject)',
    from: msg.from || '',
    to: msg.to || '',
    cc: msg.cc || '',
    bcc: msg.bcc || '',
    date: msg.date || new Date().toISOString(),
    snippet: msg.snippet || '',
    body: msg.body || '',
    isRead: !msg.isUnread,
    isStarred: msg.labelIds?.includes('STARRED') || false,
    labels: msg.labelIds || [],
    senderPhoto: msg.senderPhoto || null,
    attachments: (msg.attachments || []).map((a: any) => ({
      id: a.id || '',
      name: a.name || 'untitled',
      type: a.type || 'application/octet-stream',
      size: a.size || 0,
      messageId: a.messageId || msg.id,
    })),
  }));
}

export function useGmailConnection(options: UseGmailConnectionOptions) {
  const {
    userKey,
    callbackPrefix = 'admin',
    maxResults = 50,
    fetchPhotos = false,
    returnPath,
  } = options;

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────
  const getSession = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;
    return session;
  }, []);

  const refreshAndGetSession = useCallback(async () => {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error || !session) return null;
    return session;
  }, []);

  const fetchGmailApi = useCallback(
    async (query: string, limit = maxResults, useFreshToken = false) => {
      const session = useFreshToken ? await refreshAndGetSession() : await getSession();
      if (!session) return { messages: [], resultSizeEstimate: 0, needsAuth: false };

      const params = new URLSearchParams({
        action: 'list',
        q: query,
        maxResults: String(limit),
      });
      if (fetchPhotos) params.set('fetchPhotos', 'true');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.needsAuth) return { messages: [], resultSizeEstimate: 0, needsAuth: true };
        throw new Error(data.error || 'Failed to fetch emails');
      }
      return { ...data, needsAuth: false };
    },
    [getSession, refreshAndGetSession, maxResults, fetchPhotos],
  );

  // ── Connection status ────────────────────────────────────────────
  const {
    data: gmailConnection,
    isLoading: connectionLoading,
    refetch: refetchConnection,
  } = useQuery({
    queryKey: [`${userKey}-gmail-connection`],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_connections')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // ── Fetch emails for a folder ────────────────────────────────────
  const useEmails = (folder: FolderQuery, enabled = true) =>
    useQuery({
      queryKey: [`${userKey}-gmail-emails`, folder],
      queryFn: async () => {
        if (!gmailConnection) return { emails: [], totalCount: 0, needsAuth: false };
        const raw = await fetchGmailApi(folder, maxResults, true);
        return {
          emails: mapMessages(raw),
          totalCount: raw.resultSizeEstimate || 0,
          needsAuth: raw.needsAuth === true,
        };
      },
      enabled: !!gmailConnection && enabled,
      retry: 1,
      staleTime: 30000, // 30s before refetch
    });

  // ── Folder count (lightweight, maxResults=1) ─────────────────────
  const useFolderCount = (query: string, enabled = true) =>
    useQuery({
      queryKey: [`${userKey}-gmail-count`, query],
      queryFn: async () => {
        if (!gmailConnection) return 0;
        const raw = await fetchGmailApi(query, 1);
        return raw.resultSizeEstimate || 0;
      },
      enabled: !!gmailConnection && enabled,
      staleTime: 60000,
    });

  // ── Send email ───────────────────────────────────────────────────
  const sendEmailMutation = useMutation({
    mutationFn: async (payload: {
      to: string;
      subject: string;
      body: string;
      bodyPlain?: string;
      threadId?: string;
      inReplyTo?: string;
      flowId?: string;
      attachments?: { filename: string; mimeType: string; data?: string }[];
    }) => {
      const session = await getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api?action=send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send email');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${userKey}-gmail-emails`] });
    },
  });

  // ── Connect Gmail (full page redirect) ───────────────────────────
  const connectGmail = useCallback(async () => {
    setIsConnecting(true);
    try {
      const session = await getSession();
      if (!session) {
        toast.error('Please log in to connect Gmail');
        return;
      }

      const callbackUrl = getGmailCallbackUrl(callbackPrefix);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api?action=get-oauth-url`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ redirect_uri: callbackUrl }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get auth URL');
      if (!data?.url) throw new Error('Missing auth URL');

      if (returnPath) {
        localStorage.setItem('gmail_return_path', returnPath);
      }
      window.location.href = data.url;
    } catch (err: any) {
      console.error('Failed to get auth URL:', err);
      toast.error('Failed to connect Gmail');
    } finally {
      setIsConnecting(false);
    }
  }, [getSession, callbackPrefix, returnPath]);

  // ── Disconnect Gmail ─────────────────────────────────────────────
  const disconnectGmail = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('gmail_connections')
        .delete()
        .eq('user_id', user?.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: [`${userKey}-gmail-connection`] });
      toast.success('Gmail disconnected');
    } catch {
      toast.error('Failed to disconnect Gmail');
    }
  }, [user?.id, queryClient, userKey]);

  // ── Invalidate all email queries ─────────────────────────────────
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [`${userKey}-gmail-emails`] });
    queryClient.invalidateQueries({ queryKey: [`${userKey}-gmail-count`] });
    queryClient.invalidateQueries({ queryKey: [`${userKey}-gmail-connection`] });
  }, [queryClient, userKey]);

  return {
    // Connection
    gmailConnection,
    connectionLoading,
    refetchConnection,
    isConnecting,
    connectGmail,
    disconnectGmail,

    // Data helpers
    useEmails,
    useFolderCount,
    sendEmailMutation,

    // Utils
    invalidateAll,
    getSession,
    refreshAndGetSession,
    fetchGmailApi,
    userKey,
  };
}
