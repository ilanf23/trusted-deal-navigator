import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  isUnread: boolean;
}

interface GmailStatus {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
}

export function useGmail() {
  const [status, setStatus] = useState<GmailStatus>({ connected: false, email: null, connectedAt: null });
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const { toast } = useToast();

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : null;
  };

  const callGmailApi = useCallback(async (action: string, params?: Record<string, string>, body?: any) => {
    const authHeader = await getAuthHeader();
    if (!authHeader) throw new Error('Not authenticated');

    const url = new URL(`https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api`);
    url.searchParams.set('action', action);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      method: body ? 'POST' : 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const data = await callGmailApi('status');
      setStatus({
        connected: data.connected,
        email: data.email,
        connectedAt: data.connectedAt,
      });
      return data.connected;
    } catch (error) {
      console.error('Error checking Gmail status:', error);
      return false;
    }
  }, [callGmailApi]);

  const connect = useCallback(async () => {
    try {
      const redirectUri = `${window.location.origin}/superadmin/inbox/callback`;
      const data = await callGmailApi('get-oauth-url', undefined, { redirect_uri: redirectUri });
      
      // Full page redirect instead of popup
      window.location.href = data.url;
      return true;
    } catch (error: any) {
      console.error('Error connecting Gmail:', error);
      toast({
        title: 'Connection Failed',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [callGmailApi, toast]);

  const disconnect = useCallback(async () => {
    try {
      await callGmailApi('disconnect', undefined, {});
      setStatus({ connected: false, email: null, connectedAt: null });
      setMessages([]);
      toast({
        title: 'Disconnected',
        description: 'Gmail account has been disconnected.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [callGmailApi, toast]);

  const fetchMessages = useCallback(async (query?: string, loadMore = false) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { maxResults: '20' };
      if (query) params.q = query;
      if (loadMore && nextPageToken) params.pageToken = nextPageToken;

      const data = await callGmailApi('list', params);
      
      if (loadMore) {
        setMessages(prev => [...prev, ...data.messages]);
      } else {
        setMessages(data.messages || []);
      }
      setNextPageToken(data.nextPageToken || null);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      if (error.message !== 'Gmail not connected') {
        toast({
          title: 'Error',
          description: 'Failed to fetch emails',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [callGmailApi, nextPageToken, toast]);

  const getMessage = useCallback(async (messageId: string): Promise<GmailMessage | null> => {
    try {
      const data = await callGmailApi('get', { id: messageId });
      return data;
    } catch (error) {
      console.error('Error fetching message:', error);
      return null;
    }
  }, [callGmailApi]);

  const sendMessage = useCallback(async (to: string, subject: string, body: string, threadId?: string, inReplyTo?: string) => {
    try {
      await callGmailApi('send', undefined, { to, subject, body, threadId, inReplyTo });
      toast({
        title: 'Sent',
        description: 'Email sent successfully',
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Failed to send',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [callGmailApi, toast]);

  const archiveMessage = useCallback(async (messageId: string) => {
    try {
      await callGmailApi('archive', undefined, { messageId });
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast({ title: 'Archived' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [callGmailApi, toast]);

  const trashMessage = useCallback(async (messageId: string) => {
    try {
      await callGmailApi('trash', undefined, { messageId });
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast({ title: 'Moved to trash' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [callGmailApi, toast]);

  const markAsRead = useCallback(async (messageId: string, read: boolean) => {
    try {
      await callGmailApi('mark-read', undefined, { messageId, read });
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, isUnread: !read } : m
      ));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [callGmailApi, toast]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    status,
    messages,
    loading,
    hasMore: !!nextPageToken,
    connect,
    disconnect,
    fetchMessages,
    getMessage,
    sendMessage,
    archiveMessage,
    trashMessage,
    markAsRead,
    refresh: () => fetchMessages(),
  };
}