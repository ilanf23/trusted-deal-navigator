import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const SheetsCallback = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting to Google Sheets...');

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
        const redirectUri = `${window.location.origin}/admin/sheets-callback`;
        
        const response = await supabase.functions.invoke('google-sheets-auth', {
          body: { 
            action: 'exchangeCode', 
            code, 
            redirectUri,
            teamMemberName: 'admin' 
          }
        });

        if (response.error) throw response.error;
        if (response.data?.error) throw new Error(response.data.error);

        setStatus('success');
        setMessage(`Connected as ${response.data.email}`);
        setTimeout(() => window.close(), 1500);
      } catch (err) {
        console.error('Error exchanging code:', err);
        setStatus('error');
        setMessage('Failed to complete connection. Please try again.');
        setTimeout(() => window.close(), 2000);
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center p-8">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-slate-600 mx-auto mb-4" />
            <p className="text-slate-600">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-green-600 font-medium">{message}</p>
            <p className="text-slate-500 text-sm mt-2">This window will close automatically...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 font-medium">{message}</p>
            <p className="text-slate-500 text-sm mt-2">This window will close automatically...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default SheetsCallback;
