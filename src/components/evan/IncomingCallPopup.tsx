import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Phone, PhoneOff, User, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Device, Call } from '@twilio/voice-sdk';
import { useTeamMember } from '@/hooks/useTeamMember';

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
  const { teamMember } = useTeamMember();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Only Evan can see and respond to calls
  const isEvan = teamMember?.name?.toLowerCase() === 'evan';
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [twilioDevice, setTwilioDevice] = useState<Device | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  // Auto-navigate to calls page when an incoming call is detected
  useEffect(() => {
    if (incomingCall && isEvan && !hasNavigated && location.pathname !== '/user/evan/calls') {
      setHasNavigated(true);
      navigate('/user/evan/calls');
    }
  }, [incomingCall, isEvan, hasNavigated, navigate, location.pathname]);

  // Reset navigation flag when call ends
  useEffect(() => {
    if (!incomingCall && !isConnected) {
      setHasNavigated(false);
    }
  }, [incomingCall, isConnected]);

  // Initialize Twilio Device - Only for Evan
  const initializeTwilioDevice = useCallback(async () => {
    // Only Evan should initialize Twilio
    if (!isEvan) {
      console.log('Not Evan, skipping Twilio initialization');
      return null;
    }
    
    if (twilioDevice) {
      console.log('Twilio Device already initialized');
      return twilioDevice;
    }
    
    try {
      setIsInitializing(true);
      console.log('Initializing Twilio Device...');
      
      // Get token from edge function
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        console.log('Not authenticated, skipping Twilio initialization');
        return null;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get Twilio token');
      }

      const { token, identity } = await response.json();
      console.log('Got Twilio token for identity:', identity);
      
      // Create Twilio Device
      const device = new Device(token, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      });

      // Set up device event handlers
      device.on('registered', () => {
        console.log('Twilio Device registered and ready to receive calls');
        toast.success('Phone ready to receive calls');
      });

      device.on('error', (error) => {
        console.error('Twilio Device error:', error);
        toast.error(`Call error: ${error.message}`);
      });

      device.on('incoming', (call) => {
        console.log('Incoming call via Twilio SDK:', call.parameters);
        // Handle incoming calls through SDK
        setActiveCall(call);
        
        // Get caller info from call parameters
        const fromNumber = call.parameters.From || 'Unknown';
        console.log('Call from:', fromNumber);
        
        call.on('accept', () => {
          console.log('Call accepted');
          setIsConnected(true);
          startCallTimer();
        });
        
        call.on('disconnect', () => {
          console.log('Call disconnected');
          handleCallEnd();
        });
        
        call.on('cancel', () => {
          console.log('Call cancelled');
          handleCallEnd();
        });
        
        call.on('reject', () => {
          console.log('Call rejected');
          handleCallEnd();
        });
      });

      await device.register();
      setTwilioDevice(device);
      console.log('Twilio Device initialized successfully');
      
      return device;
    } catch (error) {
      console.error('Failed to initialize Twilio Device:', error);
      // Don't throw, just log - we'll retry on answer
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, [twilioDevice, isEvan]);

  // Auto-initialize Twilio Device on mount - Only for Evan
  useEffect(() => {
    if (isEvan) {
      initializeTwilioDevice();
    }
  }, [initializeTwilioDevice, isEvan]);

  // Start call timer
  const startCallTimer = useCallback(() => {
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  }, []);

  // Handle call end
  const handleCallEnd = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setActiveCall(null);
    setIsConnected(false);
    setIsMuted(false);
    setCallDuration(0);
    setIncomingCall(null);
    queryClient.invalidateQueries({ queryKey: ['active-calls-ringing'] });
    queryClient.invalidateQueries({ queryKey: ['evan-communications'] });
  }, [queryClient]);

  // Initial fetch for any ringing calls - Only for Evan
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
    refetchInterval: 3000,
    enabled: isEvan, // Only fetch for Evan
  });

  // Subscribe to realtime changes - Only for Evan
  useEffect(() => {
    // Only Evan should subscribe to call updates
    if (!isEvan) return;
    
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
            } else if (incomingCall?.call_sid === call.call_sid && !isConnected) {
              setIncomingCall(null);
            }
          }
          
          if (payload.eventType === 'DELETE') {
            const call = payload.old as ActiveCall;
            if (incomingCall?.call_sid === call.call_sid && !isConnected) {
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
  }, [incomingCall, isConnected, queryClient, isEvan]);

  // Set incoming call from query data
  useEffect(() => {
    if (activeCalls && activeCalls.length > 0 && !incomingCall && !isConnected) {
      setIncomingCall(activeCalls[0]);
    }
  }, [activeCalls, incomingCall, isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      if (twilioDevice) {
        twilioDevice.destroy();
      }
    };
  }, [twilioDevice]);

  const answerCall = useMutation({
    mutationFn: async () => {
      if (!incomingCall) throw new Error('No incoming call');

      // Ensure Twilio Device is registered
      const device = twilioDevice ?? (await initializeTwilioDevice());
      if (!device) {
        throw new Error('Phone is not ready yet. Please refresh the page and try again.');
      }

      // We must have an actual incoming Twilio SDK call to accept
      if (!activeCall) {
        throw new Error('Still connecting the call… please wait 1–2 seconds and press Answer again.');
      }

      // Ensure microphone permission before accepting
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        throw new Error('Microphone access is required to answer calls.');
      }

      // Accept the call in the browser
      activeCall.accept();

      // Update call status (best-effort)
      const { error } = await supabase
        .from('active_calls')
        .update({
          status: 'in-progress',
          answered_at: new Date().toISOString(),
        })
        .eq('id', incomingCall.id);

      if (error) throw error;

      return true;
    },
    onSuccess: () => {
      toast.success('Call connected!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to answer call: ${error.message}`);
    },
  });

  const hangupCall = useMutation({
    mutationFn: async () => {
      if (activeCall) {
        activeCall.disconnect();
      }
      
      if (incomingCall) {
        const { error } = await supabase
          .from('active_calls')
          .update({ 
            status: 'completed',
            ended_at: new Date().toISOString(),
          })
          .eq('id', incomingCall.id);
        
        if (error) throw error;
      }
      
      handleCallEnd();
    },
    onSuccess: () => {
      toast.info('Call ended');
    },
    onError: (error: Error) => {
      toast.error(`Failed to end call: ${error.message}`);
    },
  });

  const declineCall = useMutation({
    mutationFn: async () => {
      if (!incomingCall) throw new Error('No incoming call');
      
      if (activeCall) {
        activeCall.reject();
      }
      
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
      handleCallEnd();
    },
    onError: (error: Error) => {
      toast.error(`Failed to decline call: ${error.message}`);
    },
  });

  const toggleMute = () => {
    if (activeCall) {
      const newMuteState = !isMuted;
      activeCall.mute(newMuteState);
      setIsMuted(newMuteState);
    }
  };

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Only show popup for Evan
  const showPopup = isEvan && (incomingCall || isConnected);

  return (
    <AnimatePresence>
      {showPopup && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed top-4 right-4 z-[9999]"
        >
          <Card className={`w-80 shadow-2xl border-2 ${isConnected ? 'border-blue-500/50' : 'border-green-500/50'} bg-background/95 backdrop-blur-sm overflow-hidden`}>
            {/* Header */}
            <div className={`${isConnected ? 'bg-blue-500' : 'bg-green-500'} text-white px-4 py-3 flex items-center gap-3`}>
              <div className="relative">
                <Phone className={`h-6 w-6 ${!isConnected && 'animate-pulse'}`} />
                {!isConnected && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold">
                  {isConnected ? 'Call in Progress' : 'Incoming Call'}
                </p>
                <p className={`text-xs ${isConnected ? 'text-blue-100' : 'text-green-100'}`}>
                  {isConnected ? formatDuration(callDuration) : 'Ringing...'}
                </p>
              </div>
              {isConnected && (
                <div className="flex items-center gap-1">
                  <Volume2 className="h-4 w-4 animate-pulse" />
                </div>
              )}
            </div>
            
            <CardContent className="p-4">
              {/* Caller info */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">
                    {incomingCall?.leads?.name || 'Unknown Caller'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {incomingCall ? formatPhoneNumber(incomingCall.from_number) : ''}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              {isConnected ? (
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={toggleMute}
                  >
                    {isMuted ? (
                      <>
                        <MicOff className="h-4 w-4 mr-2 text-red-500" />
                        Unmute
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-2" />
                        Mute
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => hangupCall.mutate()}
                    disabled={hangupCall.isPending}
                  >
                    <PhoneOff className="h-4 w-4 mr-2" />
                    End Call
                  </Button>
                </div>
              ) : (
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
                    disabled={answerCall.isPending || isInitializing}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    {isInitializing ? 'Connecting...' : 'Answer'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
