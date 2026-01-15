import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const InboxCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing...');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setMessage('Authorization was cancelled or denied.');
        setTimeout(() => window.close(), 2000);
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('No authorization code received.');
        setTimeout(() => window.close(), 2000);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus('error');
          setMessage('Not authenticated. Please log in again.');
          setTimeout(() => window.close(), 2000);
          return;
        }

        const redirectUri = `${window.location.origin}/admin/inbox/callback`;
        
        const response = await fetch(
          `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=oauth-callback&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );

        const data = await response.json();

        if (response.ok && data.success) {
          setStatus('success');
          setMessage(`Connected successfully! (${data.email})`);
          setTimeout(() => window.close(), 1500);
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to connect Gmail.');
          setTimeout(() => window.close(), 3000);
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'An error occurred.');
        setTimeout(() => window.close(), 3000);
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        )}
        {status === 'success' && (
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
        )}
        {status === 'error' && (
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
        )}
        <p className="text-lg font-medium">{message}</p>
        <p className="text-sm text-muted-foreground">
          This window will close automatically.
        </p>
      </div>
    </div>
  );
};

export default InboxCallback;