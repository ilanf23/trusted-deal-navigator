import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

// Fixed callback URL - use the published domain
const CALLBACK_URL = 'https://trusted-deal-navigator.lovable.app/admin/calendar-callback';

export default function CalendarCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      // Check if this is a popup or a full page redirect
      const isPopup = window.opener !== null;

      if (error) {
        console.error('OAuth error:', error);
        setStatus('error');
        setMessage('Authorization was denied or failed');
        
        if (isPopup) {
          window.opener?.postMessage({ type: 'GOOGLE_CALENDAR_ERROR', error }, '*');
          setTimeout(() => window.close(), 1500);
        } else {
          setTimeout(() => navigate('/admin/people/evans'), 2000);
        }
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('No authorization code received');
        
        if (isPopup) {
          window.opener?.postMessage({ type: 'GOOGLE_CALENDAR_ERROR', error: 'No code' }, '*');
          setTimeout(() => window.close(), 1500);
        } else {
          setTimeout(() => navigate('/admin/people/evans'), 2000);
        }
        return;
      }

      try {
        const { data, error: exchangeError } = await supabase.functions.invoke('google-calendar-auth', {
          body: {
            action: 'exchangeCode',
            code,
            redirectUri: CALLBACK_URL,
          },
        });

        if (exchangeError) throw exchangeError;

        if (data.success) {
          setStatus('success');
          setMessage(`Connected: ${data.email}`);
          
          if (isPopup) {
            // Send message to parent window and close popup
            window.opener?.postMessage({ 
              type: 'GOOGLE_CALENDAR_CONNECTED', 
              email: data.email 
            }, '*');
            setTimeout(() => window.close(), 1000);
          } else {
            // Regular redirect flow
            setTimeout(() => navigate('/admin/people/evans'), 1500);
          }
        } else {
          throw new Error(data.error || 'Failed to connect');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setMessage('Failed to connect Google Calendar');
        
        if (isPopup) {
          window.opener?.postMessage({ type: 'GOOGLE_CALENDAR_ERROR', error: String(err) }, '*');
          setTimeout(() => window.close(), 1500);
        } else {
          setTimeout(() => navigate('/admin/people/evans'), 2000);
        }
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
            <h1 className="text-xl font-semibold">Connecting Google Calendar...</h1>
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
            <p className="text-sm text-muted-foreground">This window will close automatically...</p>
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
