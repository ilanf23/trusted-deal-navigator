import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMember } from '@/hooks/useTeamMember';
import { toast } from 'sonner';

interface DropboxConnectionState {
  isConnected: boolean;
  connectedEmail: string | null;
  connectedBy: string | null;
  lastSyncAt: string | null;
  loading: boolean;
  connect: () => void;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export function useDropboxConnection(): DropboxConnectionState {
  const { teamMember } = useTeamMember();
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [connectedBy, setConnectedBy] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('dropbox-auth', {
        body: { action: 'getStatus' },
      });
      if (error) throw error;
      setIsConnected(data.connected);
      setConnectedEmail(data.email || null);
      setConnectedBy(data.connectedBy || null);
      setLastSyncAt(data.lastSyncAt || null);
    } catch (err) {
      console.error('Failed to check Dropbox status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DROPBOX_CONNECTED') {
        setIsConnected(true);
        setConnectedEmail(event.data.email);
        setConnectedBy(teamMember?.name || null);
        toast.success('Dropbox connected successfully');
        checkStatus();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'dropbox-auth-result' && event.newValue) {
        try {
          const result = JSON.parse(event.newValue);
          if (result.type === 'DROPBOX_CONNECTED') {
            setIsConnected(true);
            setConnectedEmail(result.email);
            setConnectedBy(teamMember?.name || null);
            toast.success('Dropbox connected successfully');
            checkStatus();
          }
          localStorage.removeItem('dropbox-auth-result');
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, [teamMember, checkStatus]);

  const connect = useCallback(async () => {
    try {
      const callbackUrl = `${window.location.origin}/admin/dropbox/callback`;
      localStorage.setItem('dropboxCallbackUrl', callbackUrl);
      if (teamMember?.name) {
        localStorage.setItem('dropboxTeamMember', teamMember.name);
      }

      const { data, error } = await supabase.functions.invoke('dropbox-auth', {
        body: {
          action: 'getAuthUrl',
          redirectUri: callbackUrl,
          teamMemberName: teamMember?.name,
        },
      });

      if (error) throw error;

      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(
        data.authUrl,
        'dropbox-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );
    } catch (err) {
      console.error('Failed to start Dropbox OAuth:', err);
      toast.error('Failed to start Dropbox connection');
    }
  }, [teamMember]);

  const disconnect = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke('dropbox-auth', {
        body: { action: 'disconnect' },
      });
      if (error) throw error;
      setIsConnected(false);
      setConnectedEmail(null);
      setConnectedBy(null);
      setLastSyncAt(null);
      toast.success('Dropbox disconnected');
    } catch (err) {
      console.error('Failed to disconnect Dropbox:', err);
      toast.error('Failed to disconnect Dropbox');
    }
  }, []);

  return {
    isConnected,
    connectedEmail,
    connectedBy,
    lastSyncAt,
    loading,
    connect,
    disconnect,
    refreshStatus: checkStatus,
  };
}
