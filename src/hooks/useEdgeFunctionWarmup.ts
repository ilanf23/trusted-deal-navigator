import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Pings the twilio-inbound edge function every 5 minutes with an OPTIONS
 * request to keep the isolate warm and eliminate cold-start latency.
 * Only runs while an admin user is logged in.
 */
export function useEdgeFunctionWarmup() {
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (!isAdmin) return;

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-inbound`;
    const ping = () => fetch(url, { method: 'OPTIONS' }).catch(() => {});

    // Immediate warmup on login
    ping();

    // Re-ping every 5 minutes
    const interval = setInterval(ping, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAdmin]);
}
