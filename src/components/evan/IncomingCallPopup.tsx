import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, PhoneOff, User } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface ActiveCall {
  id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  status: string;
  direction: string;
  lead_id: string | null;
  created_at: string;
  leads?: {
    name: string;
  } | null;
}

export const IncomingCallPopup = () => {
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const queryClient = useQueryClient();

  // Initial fetch for any ringing calls
  const { data: activeCalls } = useQuery({
    queryKey: ['active-calls-ringing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('active_calls')
        .select('*, leads(name)')
        .eq('status', 'ringing')
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ActiveCall[];
    },
    refetchInterval: 3000, // Poll every 3 seconds as backup
  });

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('active-calls-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_calls',
        },
        (payload) => {
          console.log('Realtime call update:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const call = payload.new as ActiveCall;
            
            if (call.status === 'ringing' && call.direction === 'inbound') {
              setIncomingCall(call);
            } else if (incomingCall?.call_sid === call.call_sid) {
              // Call was answered or ended
              setIncomingCall(null);
            }
          }
          
          if (payload.eventType === 'DELETE') {
            const call = payload.old as ActiveCall;
            if (incomingCall?.call_sid === call.call_sid) {
              setIncomingCall(null);
            }
          }
          
          queryClient.invalidateQueries({ queryKey: ['active-calls-ringing'] });
          queryClient.invalidateQueries({ queryKey: ['evan-communications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [incomingCall, queryClient]);

  // Set incoming call from query data
  useEffect(() => {
    if (activeCalls && activeCalls.length > 0 && !incomingCall) {
      setIncomingCall(activeCalls[0]);
    }
  }, [activeCalls, incomingCall]);

  const answerCall = useMutation({
    mutationFn: async () => {
      if (!incomingCall) throw new Error('No incoming call');
      
      // Update call status to in-progress
      const { error } = await supabase
        .from('active_calls')
        .update({ 
          status: 'in-progress',
          answered_at: new Date().toISOString(),
        })
        .eq('id', incomingCall.id);
      
      if (error) throw error;
      
      // In a real implementation, this would connect via Twilio Client SDK
      // For now, we're just updating the status
      return true;
    },
    onSuccess: () => {
      toast.success('Call connected!');
      setIncomingCall(null);
      queryClient.invalidateQueries({ queryKey: ['active-calls-ringing'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to answer call: ${error.message}`);
    },
  });

  const declineCall = useMutation({
    mutationFn: async () => {
      if (!incomingCall) throw new Error('No incoming call');
      
      const { error } = await supabase
        .from('active_calls')
        .update({ 
          status: 'declined',
          ended_at: new Date().toISOString(),
        })
        .eq('id', incomingCall.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.info('Call declined');
      setIncomingCall(null);
      queryClient.invalidateQueries({ queryKey: ['active-calls-ringing'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to decline call: ${error.message}`);
    },
  });

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <AnimatePresence>
      {incomingCall && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed top-4 right-4 z-[9999]"
        >
          <Card className="w-80 shadow-2xl border-2 border-green-500/50 bg-background/95 backdrop-blur-sm overflow-hidden">
            {/* Pulsing header */}
            <div className="bg-green-500 text-white px-4 py-3 flex items-center gap-3">
              <div className="relative">
                <Phone className="h-6 w-6 animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
              </div>
              <div>
                <p className="font-semibold">Incoming Call</p>
                <p className="text-xs text-green-100">Ringing...</p>
              </div>
            </div>
            
            <CardContent className="p-4">
              {/* Caller info */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">
                    {incomingCall.leads?.name || 'Unknown Caller'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatPhoneNumber(incomingCall.from_number)}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => declineCall.mutate()}
                  disabled={declineCall.isPending}
                >
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Decline
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => answerCall.mutate()}
                  disabled={answerCall.isPending}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Answer
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
