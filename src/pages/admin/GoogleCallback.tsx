import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { getGoogleOAuthErrorMessage, type GoogleIntegration } from '@/lib/googleAuth';

export default function GoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      const state = searchParams.get('state');

      const notifyParent = (data: {
        type: string;
        email?: string;
        error?: string;
        integration?: GoogleIntegration;
      }) => {
        if (window.opener) {
          try {
            // Target our own origin only — the opener is same-origin with this
            // callback, so a wildcard target would needlessly leak the payload.
            window.opener.postMessage(data, window.location.origin);
          } catch {
            // Ignore cross-origin errors
          }
        }
        localStorage.setItem('google-auth-result', JSON.stringify({
          ...data,
          timestamp: Date.now(),
        }));
      };

      const closeOrRedirect = () => {
        const isLikelyPopup = window.opener || window.innerWidth < 600;
        if (isLikelyPopup) {
          try { window.close(); } catch { /* ignore */ }
          setTimeout(() => {
            if (!window.closed) navigate('/admin');
          }, 500);
        } else {
          const returnPath = localStorage.getItem('google_return_path');
          localStorage.removeItem('google_return_path');
          navigate(returnPath || '/admin');
        }
      };

      if (error) {
        const errorMessage = getGoogleOAuthErrorMessage(error, errorDescription);
        setStatus('error');
        setMessage(errorMessage);
        notifyParent({ type: 'GOOGLE_AUTH_ERROR', error: errorMessage });
        setTimeout(closeOrRedirect, 1500);
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setMessage('The Google authorization response was incomplete. Please reconnect.');
        notifyParent({ type: 'GOOGLE_AUTH_ERROR', error: 'Missing code or state' });
        setTimeout(closeOrRedirect, 1500);
        return;
      }

      try {
        const redirectUri = `${window.location.origin}${window.location.pathname}`;
        const { data, error: exchangeError } = await supabase.functions.invoke('google-auth', {
          body: { action: 'exchangeCode', code, redirectUri, state },
        });

        if (exchangeError) {
          const context = await exchangeError.context?.json?.().catch(() => null);
          throw new Error(context?.error || exchangeError.message);
        }

        if (data.success) {
          setStatus('success');
          setMessage(`Connected: ${data.email}`);
          notifyParent({
            type: 'GOOGLE_CONNECTED',
            email: data.email,
            integration: data.integration,
          });
          setTimeout(closeOrRedirect, 1000);
        } else {
          throw new Error(data.error || 'Failed to connect');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to connect Google account';
        setStatus('error');
        setMessage(errorMessage);
        notifyParent({ type: 'GOOGLE_AUTH_ERROR', error: errorMessage });
        setTimeout(closeOrRedirect, 1500);
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4 p-8">
        {status === 'processing' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h1 className="text-xl font-semibold">Connecting Google Account...</h1>
            <p className="text-muted-foreground">Please wait while we complete the connection.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
              <span className="text-2xl text-green-600 dark:text-green-400">✓</span>
            </div>
            <h1 className="text-xl font-semibold text-green-600 dark:text-green-400">Connected!</h1>
            <p className="text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">You can close this window now.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center mx-auto">
              <span className="text-2xl text-red-600 dark:text-red-400">✗</span>
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
