import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Fixed callback URL - use the published domain
const CALLBACK_URL = 'https://trusted-deal-navigator.lovable.app/admin/calendar-callback';

export default function CalendarCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        toast.error('Failed to connect Google Calendar');
        setStatus('error');
        setTimeout(() => navigate('/admin/people/evans'), 2000);
        return;
      }

      if (!code) {
        toast.error('No authorization code received');
        setStatus('error');
        setTimeout(() => navigate('/admin/people/evans'), 2000);
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
          toast.success(`Google Calendar connected: ${data.email}`);
          setStatus('success');
        } else {
          throw new Error(data.error || 'Failed to connect');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        toast.error('Failed to connect Google Calendar');
        setStatus('error');
      }

      // Redirect back to Evans page
      setTimeout(() => navigate('/admin/people/evans'), 1500);
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        {status === 'processing' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h1 className="text-xl font-semibold">Connecting Google Calendar...</h1>
            <p className="text-muted-foreground">Please wait while we complete the connection.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <span className="text-2xl">✓</span>
            </div>
            <h1 className="text-xl font-semibold text-green-600">Connected!</h1>
            <p className="text-muted-foreground">Redirecting back...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <span className="text-2xl">✗</span>
            </div>
            <h1 className="text-xl font-semibold text-red-600">Connection Failed</h1>
            <p className="text-muted-foreground">Redirecting back...</p>
          </>
        )}
      </div>
    </div>
  );
}

// Export the callback URL for use in other components
export { CALLBACK_URL };
