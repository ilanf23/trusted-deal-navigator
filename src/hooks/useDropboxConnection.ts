import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAuth } from '@/contexts/AuthContext';
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [connectedBy, setConnectedBy] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const invalidateDropboxQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dropbox-connection-status'] });
    queryClient.invalidateQueries({ queryKey: ['dropbox-setup-check'] });
    queryClient.invalidateQueries({ queryKey: ['dropbox-files'] });
    queryClient.invalidateQueries({ queryKey: ['dropbox-files-recursive'] });
    queryClient.invalidateQueries({ queryKey: ['dropbox-photos-db'] });
    queryClient.invalidateQueries({ queryKey: ['dropbox-shared'] });
    queryClient.invalidateQueries({ queryKey: ['add-file-dropbox-list-recursive'] });
  }, [queryClient]);

  const getDropboxPaths = useCallback(() => {
    const prefix = window.location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
    return {
      callbackUrl: `${window.location.origin}${prefix}/dropbox/callback`,
      returnPath: `${prefix}/dropbox`,
    };
  }, []);

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
  }, [user?.id]);

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
        invalidateDropboxQueries();
      } else if (event.data?.type === 'DROPBOX_ERROR') {
        toast.error(event.data.error || 'Dropbox connection failed');
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
            invalidateDropboxQueries();
          } else if (result.type === 'DROPBOX_ERROR') {
            toast.error(result.error || 'Dropbox connection failed');
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
  }, [teamMember, checkStatus, invalidateDropboxQueries]);

  const connect = useCallback(async () => {
    const { callbackUrl, returnPath } = getDropboxPaths();
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      'about:blank',
      'dropbox-oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!popup) {
      toast.error('Popup blocked. Please allow popups for this site.');
      return;
    }

    try {
      popup.document.write(
        '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui"><p>Connecting to Dropbox...</p></body></html>'
      );

      localStorage.setItem('dropboxCallbackUrl', callbackUrl);
      localStorage.setItem('dropboxReturnPath', returnPath);
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
      if (!data?.authUrl) throw new Error('Missing Dropbox auth URL');

      popup.location.href = data.authUrl;
    } catch (err) {
      popup.close();
      console.error('Failed to start Dropbox OAuth:', err);
      toast.error('Failed to start Dropbox connection');
    }
  }, [getDropboxPaths, teamMember]);

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
      invalidateDropboxQueries();
    } catch (err) {
      console.error('Failed to disconnect Dropbox:', err);
      toast.error('Failed to disconnect Dropbox');
    }
  }, [invalidateDropboxQueries]);

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
