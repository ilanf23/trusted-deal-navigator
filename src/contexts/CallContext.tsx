import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Device, Call } from '@twilio/voice-sdk';
import { useTeamMember } from '@/hooks/useTeamMember';

interface ActiveCallData {
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

interface CallContextType {
  incomingCall: ActiveCallData | null;
  activeCall: Call | null;
  isConnected: boolean;
  isMuted: boolean;
  callDuration: number;
  isInitializing: boolean;
  answerCall: () => Promise<void>;
  hangupCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  toggleMute: () => void;
  isEvan: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const { teamMember } = useTeamMember();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  const isEvan = teamMember?.name?.toLowerCase() === 'evan';
  
  const [incomingCall, setIncomingCall] = useState<ActiveCallData | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [twilioDevice, setTwilioDevice] = useState<Device | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const deviceRef = useRef<Device | null>(null);

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

  // Initialize Twilio Device
  const initializeTwilioDevice = useCallback(async () => {
    if (!isEvan) {
      console.log('Not Evan, skipping Twilio initialization');
      return null;
    }
    
    if (deviceRef.current) {
      console.log('Twilio Device already initialized');
      return deviceRef.current;
    }
    
    try {
      setIsInitializing(true);
      console.log('Initializing Twilio Device...');
      
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
      
      const device = new Device(token, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      });

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
        setActiveCall(call);
        
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
      deviceRef.current = device;
      setTwilioDevice(device);
      console.log('Twilio Device initialized successfully');
      
      return device;
    } catch (error) {
      console.error('Failed to initialize Twilio Device:', error);
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, [isEvan, startCallTimer, handleCallEnd]);

  // Auto-initialize Twilio Device on mount
  useEffect(() => {
    if (isEvan) {
      initializeTwilioDevice();
    }
    
    return () => {
      // Don't destroy the device on unmount - we want it to persist
    };
  }, [initializeTwilioDevice, isEvan]);

  // Cleanup on provider unmount (app close)
  useEffect(() => {
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      if (deviceRef.current) {
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
    };
  }, []);

  // Auto-navigate to calls page when an incoming call is detected (only for ringing, not connected)
  useEffect(() => {
    if (incomingCall && isEvan && !hasNavigated && !isConnected && 
        location.pathname !== '/user/evan/calls' && location.pathname !== '/team/evan/calls') {
      setHasNavigated(true);
      navigate('/team/evan/calls');
    }
  }, [incomingCall, isEvan, hasNavigated, isConnected, navigate, location.pathname]);

  // Reset navigation flag when call ends
  useEffect(() => {
    if (!incomingCall && !isConnected) {
      setHasNavigated(false);
    }
  }, [incomingCall, isConnected]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!isEvan) return;
    
    // Initial fetch for any ringing calls
    const fetchRingingCalls = async () => {
      const { data, error } = await supabase
        .from('active_calls')
        .select('*, leads(name)')
        .eq('status', 'ringing')
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false });
      
      if (!error && data && data.length > 0 && !incomingCall && !isConnected) {
        setIncomingCall(data[0] as ActiveCallData);
      }
    };
    
    fetchRingingCalls();
    const pollInterval = setInterval(fetchRingingCalls, 3000);
    
    const channel = supabase
      .channel('active-calls-realtime-context')
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
            const call = payload.new as ActiveCallData;
            
            if (call.status === 'ringing' && call.direction === 'inbound') {
              setIncomingCall(call);
            } else if (incomingCall?.call_sid === call.call_sid && !isConnected) {
              setIncomingCall(null);
            }
          }
          
          if (payload.eventType === 'DELETE') {
            const call = payload.old as ActiveCallData;
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
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [isEvan, incomingCall, isConnected, queryClient]);

  const answerCall = useCallback(async () => {
    if (!incomingCall) throw new Error('No incoming call');

    const device = deviceRef.current ?? (await initializeTwilioDevice());
    if (!device) {
      throw new Error('Phone is not ready yet. Please refresh the page and try again.');
    }

    if (!activeCall) {
      throw new Error('Still connecting the call… please wait 1–2 seconds and press Answer again.');
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new Error('Microphone access is required to answer calls.');
    }

    activeCall.accept();

    const { error } = await supabase
      .from('active_calls')
      .update({
        status: 'in-progress',
        answered_at: new Date().toISOString(),
      })
      .eq('id', incomingCall.id);

    if (error) throw error;
    
    toast.success('Call connected!');
  }, [incomingCall, activeCall, initializeTwilioDevice]);

  const hangupCall = useCallback(async () => {
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
    toast.info('Call ended');
  }, [activeCall, incomingCall, handleCallEnd]);

  const declineCall = useCallback(async () => {
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
    
    toast.info('Call declined');
    handleCallEnd();
  }, [incomingCall, activeCall, handleCallEnd]);

  const toggleMute = useCallback(() => {
    if (activeCall) {
      const newMuteState = !isMuted;
      activeCall.mute(newMuteState);
      setIsMuted(newMuteState);
    }
  }, [activeCall, isMuted]);

  const value: CallContextType = {
    incomingCall,
    activeCall,
    isConnected,
    isMuted,
    callDuration,
    isInitializing,
    answerCall,
    hangupCall,
    declineCall,
    toggleMute,
    isEvan,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};
