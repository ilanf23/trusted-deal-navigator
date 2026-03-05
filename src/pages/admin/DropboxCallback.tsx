import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const getCallbackUrl = () => {
  const storedUrl = localStorage.getItem('dropboxCallbackUrl');
  if (storedUrl) return storedUrl;
  return `${window.location.origin}/admin/dropbox/callback`;
};

export default function DropboxCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state'); // Contains userId from getAuthUrl
      const error = urlParams.get('error');

      const notifyParent = (data: { type: string; email?: string; error?: string }) => {
        if (window.opener) {
          try {
            window.opener.postMessage(data, '*');
          } catch {
            // Ignore cross-origin errors
          }
        }
        localStorage.setItem('dropbox-auth-result', JSON.stringify({
          ...data,
          timestamp: Date.now(),
        }));
      };

      const closeOrRedirect = () => {
        const isLikelyPopup = window.opener || window.innerWidth < 600;
        if (isLikelyPopup) {
          try {
            window.close();
          } catch {
            // Can't close
          }
          setTimeout(() => {
            if (!window.closed) navigate('/admin/dropbox');
          }, 500);
        } else {
          navigate('/admin/dropbox');
        }
      };

      if (error) {
        console.error('Dropbox OAuth error:', error);
        setStatus('error');
        setMessage('Authorization was denied or failed');
        notifyParent({ type: 'DROPBOX_ERROR', error });
        setTimeout(closeOrRedirect, 1500);
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('No authorization code received');
        notifyParent({ type: 'DROPBOX_ERROR', error: 'No code' });
        setTimeout(closeOrRedirect, 1500);
        return;
      }

      try {
        // Wait for session to restore (safety net for popup windows)
        await supabase.auth.getSession();

        const teamMemberName = localStorage.getItem('dropboxTeamMember') || undefined;
        const callbackUrl = getCallbackUrl();

        const { data, error: exchangeError } = await supabase.functions.invoke('dropbox-auth', {
          body: {
            action: 'exchangeCode',
            code,
            redirectUri: callbackUrl,
            teamMemberName,
            stateUserId: state || undefined, // Pass OAuth state as fallback user_id
          },
        });

        localStorage.removeItem('dropboxCallbackUrl');
        localStorage.removeItem('dropboxTeamMember');

        if (exchangeError) {
          // Try to extract detailed error from edge function response
          const detailMsg = data?.error || exchangeError.message || 'Connection failed';
          throw new Error(detailMsg);
        }

        if (data.success) {
          setStatus('success');
          setMessage(`Connected: ${data.email}`);
          notifyParent({ type: 'DROPBOX_CONNECTED', email: data.email });
          setTimeout(closeOrRedirect, 1000);
        } else {
          const errorMsg = data.error || 'Failed to connect';
          setStatus('error');
          setMessage(errorMsg);
          notifyParent({ type: 'DROPBOX_ERROR', error: errorMsg });
          setTimeout(closeOrRedirect, 1500);
        }
      } catch (err: unknown) {
        console.error('Dropbox OAuth callback error:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to connect Dropbox';
        setStatus('error');
        setMessage(errorMsg);
        notifyParent({ type: 'DROPBOX_ERROR', error: errorMsg });
        setTimeout(closeOrRedirect, 1500);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4 p-8">
        {status === 'processing' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h1 className="text-xl font-semibold">Connecting Dropbox...</h1>
            <p className="text-muted-foreground">Please wait while we complete the connection.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
              <span className="text-2xl text-green-600 dark:text-green-400">&#10003;</span>
            </div>
            <h1 className="text-xl font-semibold text-green-600 dark:text-green-400">Connected!</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">You can close this window now.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center mx-auto">
              <span className="text-2xl text-red-600 dark:text-red-400">&#10007;</span>
            </div>
            <h1 className="text-xl font-semibold text-red-600 dark:text-red-400">Connection Failed</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">Redirecting back...</p>
          </>
        )}
      </div>
    </div>
  );
}
