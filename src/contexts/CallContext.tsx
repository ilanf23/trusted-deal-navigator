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
  call_flow_id?: string;
  leads?: {
    name: string;
  } | null;
}

interface OutboundCallState {
  phoneNumber: string;
  leadId?: string;
  leadName?: string;
  status: 'idle' | 'dialing' | 'ringing' | 'connected' | 'ended';
  callSid?: string;
}

interface CallHealthStatus {
  deviceReady: boolean;
  socketConnected: boolean;
  lastHeartbeat: Date | null;
  missedCallsCount: number;
}

interface CallContextType {
  incomingCall: ActiveCallData | null;
  activeCall: Call | null;
  isConnected: boolean;
  isMuted: boolean;
  callDuration: number;
  isInitializing: boolean;
  healthStatus: CallHealthStatus;
  outboundCall: OutboundCallState | null;
  answerCall: () => Promise<void>;
  hangupCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  toggleMute: () => void;
  makeOutboundCall: (phoneNumber: string, leadId?: string, leadName?: string) => Promise<void>;
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
  const [outboundCall, setOutboundCall] = useState<OutboundCallState | null>(null);
  const [healthStatus, setHealthStatus] = useState<CallHealthStatus>({
    deviceReady: false,
    socketConnected: false,
    lastHeartbeat: null,
    missedCallsCount: 0,
  });
  
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const pendingCallsRef = useRef<ActiveCallData[]>([]);

  // Log frontend event for call tracing
  const logCallEvent = useCallback(async (
    callSid: string, 
    eventType: string, 
    callFlowId?: string,
    metadata?: Record<string, unknown>
  ) => {
    try {
      await supabase.from('call_events').insert({
        call_flow_id: callFlowId || crypto.randomUUID(),
        call_sid: callSid,
        event_type: eventType,
        frontend_received: true,
        frontend_acknowledged_at: new Date().toISOString(),
        device_ready: deviceRef.current?.state === 'registered',
        socket_connected: healthStatus.socketConnected,
        user_session_active: true,
        metadata: {
          ...metadata,
          location: location.pathname,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[CallContext] Failed to log call event:', error);
    }
  }, [healthStatus.socketConnected, location.pathname]);

  // Acknowledge call receipt to database
  const acknowledgeCall = useCallback(async (call: ActiveCallData) => {
    try {
      await supabase
        .from('active_calls')
        .update({ frontend_ack_at: new Date().toISOString() })
        .eq('id', call.id);
      
      await logCallEvent(call.call_sid, 'frontend_acknowledged', call.call_flow_id);
      console.log('[CallContext] Call acknowledged:', call.call_sid);
    } catch (error) {
      console.error('[CallContext] Failed to acknowledge call:', error);
    }
  }, [logCallEvent]);

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
    setOutboundCall(null);
    queryClient.invalidateQueries({ queryKey: ['active-calls-ringing'] });
    queryClient.invalidateQueries({ queryKey: ['evan-communications'] });
    queryClient.invalidateQueries({ queryKey: ['evan-call-history'] });
  }, [queryClient]);

  // Initialize Twilio Device - EAGER initialization
  const initializeTwilioDevice = useCallback(async () => {
    if (!isEvan) {
      console.log('[CallContext] Not Evan, skipping Twilio initialization');
      return null;
    }
    
    if (deviceRef.current?.state === 'registered') {
      console.log('[CallContext] Twilio Device already registered');
      return deviceRef.current;
    }
    
    try {
      setIsInitializing(true);
      console.log('[CallContext] Initializing Twilio Device...');
      
      // Refresh the session to ensure we have a valid, non-expired token
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed?.session?.access_token) {
        console.log('[CallContext] Not authenticated or session refresh failed, skipping Twilio initialization');
        return null;
      }
      const session = refreshed;

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
      console.log('[CallContext] Got Twilio token for identity:', identity);
      
      // Destroy existing device if any
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
      
      const device = new Device(token, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        // Enable edge locations for better connectivity
        edge: ['ashburn', 'dublin', 'singapore'],
      });

      device.on('registered', () => {
        console.log('[CallContext] Twilio Device registered and ready');
        setHealthStatus(prev => ({ ...prev, deviceReady: true, lastHeartbeat: new Date() }));
        toast.success('Phone ready to receive calls');
        
        // Process any pending calls
        if (pendingCallsRef.current.length > 0) {
          console.log('[CallContext] Processing pending calls:', pendingCallsRef.current.length);
          const pendingCall = pendingCallsRef.current.shift();
          if (pendingCall && !incomingCall && !isConnected) {
            setIncomingCall(pendingCall);
            acknowledgeCall(pendingCall);
          }
        }
      });

      device.on('unregistered', () => {
        console.log('[CallContext] Twilio Device unregistered');
        setHealthStatus(prev => ({ ...prev, deviceReady: false }));
      });

      device.on('error', (error) => {
        console.error('[CallContext] Twilio Device error:', error);
        setHealthStatus(prev => ({ ...prev, deviceReady: false }));
        
        // Check if it's a token expiry error — refresh token silently instead of spamming toasts
        const isTokenExpired = error.code === 20104 || 
          error.message?.includes('expired') || 
          error.message?.includes('AccessTokenExpired');
        
        if (isTokenExpired) {
          console.log('[CallContext] Token expired, destroying device and fetching fresh token...');
          // Destroy the stale device to stop the error loop
          if (deviceRef.current) {
            deviceRef.current.destroy();
            deviceRef.current = null;
            setTwilioDevice(null);
          }
          // Re-initialize with a fresh token after a short delay
          setTimeout(() => {
            initializeTwilioDevice();
          }, 2000);
        } else {
          toast.error(`Call error: ${error.message}`);
          // Try to re-register on non-token errors
          setTimeout(() => {
            if (deviceRef.current && deviceRef.current.state !== 'registered') {
              console.log('[CallContext] Attempting to re-register device...');
              deviceRef.current.register();
            }
          }, 5000);
        }
      });

      device.on('incoming', (call) => {
        console.log('[CallContext] Incoming call via Twilio SDK:', call.parameters);
        setActiveCall(call);
        
        const fromNumber = call.parameters.From || 'Unknown';
        console.log('[CallContext] Call from:', fromNumber);
        
        // Log SDK event
        logCallEvent(call.parameters.CallSid || 'unknown', 'sdk_incoming_received', undefined, {
          from: fromNumber,
          call_parameters: call.parameters,
        });
        
        call.on('accept', () => {
          console.log('[CallContext] Call accepted');
          setIsConnected(true);
          startCallTimer();
          logCallEvent(call.parameters.CallSid || 'unknown', 'call_accepted');
        });
        
        call.on('disconnect', () => {
          console.log('[CallContext] Call disconnected');
          logCallEvent(call.parameters.CallSid || 'unknown', 'call_disconnected');
          handleCallEnd();
        });
        
        call.on('cancel', () => {
          console.log('[CallContext] Call cancelled');
          logCallEvent(call.parameters.CallSid || 'unknown', 'call_cancelled');
          handleCallEnd();
        });
        
        call.on('reject', () => {
          console.log('[CallContext] Call rejected');
          logCallEvent(call.parameters.CallSid || 'unknown', 'call_rejected');
          handleCallEnd();
        });
      });

      await device.register();
      deviceRef.current = device;
      setTwilioDevice(device);
      console.log('[CallContext] Twilio Device initialized successfully');
      
      return device;
    } catch (error) {
      console.error('[CallContext] Failed to initialize Twilio Device:', error);
      setHealthStatus(prev => ({ ...prev, deviceReady: false }));
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, [isEvan, startCallTimer, handleCallEnd, incomingCall, isConnected, acknowledgeCall, logCallEvent]);

  // EAGER initialization - initialize as soon as Evan is detected
  useEffect(() => {
    if (isEvan) {
      console.log('[CallContext] Evan detected, eagerly initializing Twilio Device');
      initializeTwilioDevice();
    }
    
    return () => {
      // Don't destroy on unmount - persist across navigation
    };
  }, [isEvan]); // Only depend on isEvan, not the function

  // Keep device warm with periodic re-registration
  useEffect(() => {
    if (!isEvan) return;
    
    const keepWarm = setInterval(() => {
      if (deviceRef.current) {
        if (deviceRef.current.state !== 'registered') {
          console.log('[CallContext] Device not registered, attempting to register...');
          deviceRef.current.register().catch(err => {
            console.error('[CallContext] Failed to re-register:', err);
          });
        } else {
          setHealthStatus(prev => ({ ...prev, lastHeartbeat: new Date() }));
        }
      } else {
        console.log('[CallContext] No device, reinitializing...');
        initializeTwilioDevice();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(keepWarm);
  }, [isEvan, initializeTwilioDevice]);

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
        location.pathname !== '/admin/evan/calls') {
      setHasNavigated(true);
      navigate('/admin/evan/calls');
    }
  }, [incomingCall, isEvan, hasNavigated, isConnected, navigate, location.pathname]);

  // Reset navigation flag when call ends
  useEffect(() => {
    if (!incomingCall && !isConnected) {
      setHasNavigated(false);
    }
  }, [incomingCall, isConnected]);

  // Subscribe to realtime changes with robust handling
  useEffect(() => {
    if (!isEvan) return;
    
    // Initial fetch for any ringing calls - process buffered calls
    const fetchRingingCalls = async () => {
      const { data, error } = await supabase
        .from('active_calls')
        .select('*, leads(name)')
        .eq('status', 'ringing')
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false });
      
      if (!error && data && data.length > 0) {
        console.log('[CallContext] Found ringing calls:', data.length);
        
        if (!incomingCall && !isConnected) {
          const call = data[0] as ActiveCallData;
          
          // Check if device is ready - if not, buffer the call
          if (deviceRef.current?.state !== 'registered') {
            console.log('[CallContext] Device not ready, buffering call:', call.call_sid);
            pendingCallsRef.current.push(call);
            
            // Try to initialize device
            initializeTwilioDevice();
          } else {
            setIncomingCall(call);
            acknowledgeCall(call);
          }
        }
      }
    };
    
    fetchRingingCalls();
    const pollInterval = setInterval(fetchRingingCalls, 2000); // Poll every 2s for faster response
    
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
          console.log('[CallContext] Realtime call update:', payload.eventType, payload.new);
          setHealthStatus(prev => ({ ...prev, socketConnected: true, lastHeartbeat: new Date() }));
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const call = payload.new as ActiveCallData;
            
            if (call.status === 'ringing' && call.direction === 'inbound') {
              console.log('[CallContext] New ringing call detected:', call.call_sid);
              
              // Log that we received the realtime event
              logCallEvent(call.call_sid, 'realtime_received', call.call_flow_id);
              
              // Check if device is ready
              if (deviceRef.current?.state !== 'registered') {
                console.log('[CallContext] Device not ready for realtime call, buffering');
                pendingCallsRef.current.push(call);
                initializeTwilioDevice();
              } else if (!incomingCall && !isConnected) {
                setIncomingCall(call);
                acknowledgeCall(call);
              }
            } else if (incomingCall?.call_sid === call.call_sid && !isConnected) {
              // Call status changed from ringing
              if (call.status !== 'ringing') {
                console.log('[CallContext] Call no longer ringing:', call.status);
                setIncomingCall(null);
              }
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
      .subscribe((status) => {
        console.log('[CallContext] Realtime subscription status:', status);
        setHealthStatus(prev => ({ 
          ...prev, 
          socketConnected: status === 'SUBSCRIBED',
          lastHeartbeat: new Date(),
        }));
      });

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [isEvan, incomingCall, isConnected, queryClient, acknowledgeCall, logCallEvent, initializeTwilioDevice]);

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

    await logCallEvent(incomingCall.call_sid, 'answer_attempted', incomingCall.call_flow_id);
    
    activeCall.accept();

    const { error } = await supabase
      .from('active_calls')
      .update({
        status: 'in-progress',
        answered_at: new Date().toISOString(),
      })
      .eq('id', incomingCall.id);

    if (error) throw error;
    
    await logCallEvent(incomingCall.call_sid, 'call_answered', incomingCall.call_flow_id);
    toast.success('Call connected!');
  }, [incomingCall, activeCall, initializeTwilioDevice, logCallEvent]);

  const hangupCall = useCallback(async () => {
    if (activeCall) {
      activeCall.disconnect();
    }
    
    if (incomingCall) {
      await logCallEvent(incomingCall.call_sid, 'hangup', incomingCall.call_flow_id);
      
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
  }, [activeCall, incomingCall, handleCallEnd, logCallEvent]);

  const declineCall = useCallback(async () => {
    if (!incomingCall) throw new Error('No incoming call');
    
    await logCallEvent(incomingCall.call_sid, 'declined', incomingCall.call_flow_id);
    
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
  }, [incomingCall, activeCall, handleCallEnd, logCallEvent]);

  const toggleMute = useCallback(() => {
    if (activeCall) {
      const newMuteState = !isMuted;
      activeCall.mute(newMuteState);
      setIsMuted(newMuteState);
    }
  }, [activeCall, isMuted]);

  // Make outbound call using Twilio Device
  const makeOutboundCall = useCallback(async (phoneNumber: string, leadId?: string, leadName?: string) => {
    if (!isEvan) {
      toast.error('Only Evan can make calls');
      return;
    }

    const device = deviceRef.current ?? (await initializeTwilioDevice());
    if (!device || device.state !== 'registered') {
      toast.error('Phone is not ready. Please wait and try again.');
      return;
    }

    // Format phone number
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (formattedPhone.length === 10) {
      formattedPhone = '+1' + formattedPhone;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    try {
      // Set outbound call state to dialing
      setOutboundCall({
        phoneNumber: formattedPhone,
        leadId,
        leadName,
        status: 'dialing',
      });

      console.log('[CallContext] Initiating outbound call to:', formattedPhone);

      // Make the call through Twilio Device
      const call = await device.connect({
        params: {
          To: formattedPhone,
        },
      });

      setActiveCall(call);
      setOutboundCall(prev => prev ? { ...prev, status: 'ringing', callSid: call.parameters.CallSid } : null);

      call.on('ringing', () => {
        console.log('[CallContext] Outbound call ringing');
        setOutboundCall(prev => prev ? { ...prev, status: 'ringing' } : null);
      });

      call.on('accept', () => {
        console.log('[CallContext] Outbound call connected');
        setOutboundCall(prev => prev ? { ...prev, status: 'connected' } : null);
        setIsConnected(true);
        startCallTimer();
        toast.success('Call connected!');
      });

      call.on('disconnect', () => {
        console.log('[CallContext] Outbound call ended');
        handleCallEnd();
        toast.info('Call ended');
      });

      call.on('cancel', () => {
        console.log('[CallContext] Outbound call cancelled');
        handleCallEnd();
      });

      call.on('error', (error) => {
        console.error('[CallContext] Outbound call error:', error);
        toast.error(`Call failed: ${error.message}`);
        handleCallEnd();
      });

      // Log the call to communications
      await supabase.from('evan_communications').insert({
        lead_id: leadId || null,
        communication_type: 'call',
        direction: 'outbound',
        content: `Call initiated to ${formattedPhone}`,
        phone_number: formattedPhone,
        status: 'ringing',
        call_sid: call.parameters.CallSid,
      });

    } catch (error) {
      console.error('[CallContext] Failed to make outbound call:', error);
      toast.error('Failed to initiate call');
      setOutboundCall(null);
    }
  }, [isEvan, initializeTwilioDevice, startCallTimer, handleCallEnd]);

  const value: CallContextType = {
    incomingCall,
    activeCall,
    isConnected,
    isMuted,
    callDuration,
    isInitializing,
    healthStatus,
    outboundCall,
    answerCall,
    hangupCall,
    declineCall,
    toggleMute,
    makeOutboundCall,
    isEvan,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};
