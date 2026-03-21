import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Device, Call } from '@twilio/voice-sdk';
import { useAuth } from '@/contexts/AuthContext';

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
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  // Use stable role-based check instead of fragile name comparison.
  // Any authenticated admin can initialize the Twilio Device.
  // The twilio-token edge function enforces server-side authorization.
  const isCallEnabled = isAdmin && !!user;
  
  // Keep isEvan in the context type for backward compat, mapped to isCallEnabled
  const isEvan = isCallEnabled;
  
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
  // pendingCallsRef removed — calls are shown immediately regardless of device state
  const incomingCallRef = useRef<ActiveCallData | null>(null);
  const isConnectedRef = useRef(false);
  const isReinitializingRef = useRef(false);
  const lastErrorToastRef = useRef<number>(0);

  // Ring tone synthesizer — plays a dual-tone phone ring while a call is waiting
  const ringStopRef = useRef<(() => void) | null>(null);

  const startRinging = useCallback(() => {
    if (ringStopRef.current) return; // Already ringing
    let stopped = false;
    let audioCtx: AudioContext | null = null;
    let nextRingTimeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleRing = (ctx: AudioContext) => {
      if (stopped) return;
      const now = ctx.currentTime;

      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      [480, 440].forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.5);
      });

      // 0.5s ring + 1.5s silence = 2s cycle
      nextRingTimeout = setTimeout(() => scheduleRing(ctx), 2000);
    };

    try {
      audioCtx = new AudioContext();
      scheduleRing(audioCtx);
    } catch (e) {
      console.warn('[CallContext] Could not start ringtone:', e);
      return;
    }

    ringStopRef.current = () => {
      stopped = true;
      if (nextRingTimeout) clearTimeout(nextRingTimeout);
      audioCtx?.close().catch(() => {});
      ringStopRef.current = null;
    };
  }, []);

  const stopRinging = useCallback(() => {
    ringStopRef.current?.();
  }, []);

  // Keep refs in sync with state
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);
  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

  // Log frontend event for call tracing — stable ref-based callback
  const logCallEventRef = useRef<(
    callSid: string, 
    eventType: string, 
    callFlowId?: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>>();
  
  logCallEventRef.current = async (
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
  };

  const logCallEvent = useCallback(async (
    callSid: string, 
    eventType: string, 
    callFlowId?: string,
    metadata?: Record<string, unknown>
  ) => {
    return logCallEventRef.current?.(callSid, eventType, callFlowId, metadata);
  }, []);

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

    if (isReinitializingRef.current) {
      console.log('[CallContext] Already reinitializing, skipping');
      return deviceRef.current;
    }
    
    isReinitializingRef.current = true;
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
        console.log('[CallContext] ✅ Twilio Device REGISTERED — device.state:', device.state, '— identity:', identity);
        setHealthStatus(prev => ({ ...prev, deviceReady: true, lastHeartbeat: new Date() }));
        
        // Device is now ready — no pending call processing needed
        // Calls are shown immediately via realtime/polling regardless of device state
      });

      device.on('registering', () => {
        console.log('[CallContext] 🔄 Twilio Device REGISTERING...');
      });

      device.on('unregistered', () => {
        console.log('[CallContext] ⚠️ Twilio Device UNREGISTERED — device.state:', device.state);
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
          // Re-initialize with a fresh token after a short delay (guarded)
          setTimeout(() => {
            if (!isReinitializingRef.current) {
              initializeTwilioDevice();
            }
          }, 2000);
        } else {
          // Log only — no user-facing toast
          console.warn('[CallContext] Non-token error:', error.message);
          // Try to re-register on non-token errors (only if unregistered)
          setTimeout(() => {
            if (deviceRef.current && deviceRef.current.state === 'unregistered') {
              console.log('[CallContext] Attempting to re-register device...');
              deviceRef.current.register();
            }
          }, 5000);
        }
      });

      device.on('incoming', (call) => {
        const fromNumber = call.parameters.From || 'Unknown';
        const callSid = call.parameters.CallSid || '';
        console.log('[CallContext] Incoming call via Twilio SDK — CallSid:', callSid, 'From:', fromNumber);
        setActiveCall(call);
        
        // Create synthetic incomingCall immediately from SDK params
        // so the popup shows without waiting for DB realtime subscription
        if (!incomingCallRef.current && !isConnectedRef.current) {
          const syntheticCall: ActiveCallData = {
            id: callSid,
            call_sid: callSid,
            from_number: fromNumber,
            to_number: '',
            status: 'ringing',
            direction: 'inbound',
            lead_id: null,
            created_at: new Date().toISOString(),
            leads: null,
          };
          console.log('[CallContext] Setting synthetic incomingCall for immediate popup display');
          setIncomingCall(syntheticCall);
        }
        
        // Log SDK event
        logCallEvent(callSid || 'unknown', 'sdk_incoming_received', undefined, {
          from: fromNumber,
          call_parameters: call.parameters,
        });
        
        call.on('accept', () => {
          console.log('[CallContext] Call accepted');
          setIsConnected(true);
          startCallTimer();
          logCallEvent(callSid || 'unknown', 'call_accepted');
        });
        
        call.on('disconnect', () => {
          console.log('[CallContext] Call disconnected');
          logCallEvent(callSid || 'unknown', 'call_disconnected');
          handleCallEnd();
        });
        
        call.on('cancel', () => {
          console.log('[CallContext] Call cancelled');
          logCallEvent(callSid || 'unknown', 'call_cancelled');
          handleCallEnd();
        });
        
        call.on('reject', () => {
          console.log('[CallContext] Call rejected');
          logCallEvent(callSid || 'unknown', 'call_rejected');
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
      isReinitializingRef.current = false;
    }
  // Note: incomingCall and isConnected removed from deps — we use refs instead
  // to prevent device re-initialization when call state changes
  }, [isEvan, startCallTimer, handleCallEnd, acknowledgeCall, logCallEvent]);

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
        if (deviceRef.current.state === 'unregistered') {
          console.log('[CallContext] Device unregistered, attempting to register...');
          deviceRef.current.register().catch(err => {
            console.error('[CallContext] Failed to re-register:', err);
          });
        } else {
          setHealthStatus(prev => ({ ...prev, lastHeartbeat: new Date() }));
        }
      } else if (!isReinitializingRef.current) {
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
        location.pathname !== '/admin/calls') {
      setHasNavigated(true);
      navigate('/admin/calls');
    }
  }, [incomingCall, isEvan, hasNavigated, isConnected, navigate, location.pathname]);

  // Reset navigation flag when call ends
  useEffect(() => {
    if (!incomingCall && !isConnected) {
      setHasNavigated(false);
    }
  }, [incomingCall, isConnected]);

  // Ring tone: play while an incoming call is waiting; stop once answered or cleared
  useEffect(() => {
    if (incomingCall && !isConnected) {
      startRinging();
    } else {
      stopRinging();
    }
    return () => stopRinging();
  }, [incomingCall, isConnected, startRinging, stopRinging]);

  // Subscribe to realtime changes with robust handling
  // Uses refs for mutable state so the effect is stable (only depends on isEvan)
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
        const now = Date.now();
        const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

        // Auto-complete stale ringing calls that were never answered
        const staleCalls = data.filter(
          (c) => now - new Date(c.created_at).getTime() > STALE_THRESHOLD_MS
        );
        if (staleCalls.length > 0) {
          console.log('[CallContext] Cleaning up', staleCalls.length, 'stale ringing call(s)');
          for (const stale of staleCalls) {
            supabase
              .from('active_calls')
              .update({ status: 'completed', ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('id', stale.id)
              .then(({ error: e }) => { if (e) console.error('[CallContext] Failed to clean stale call:', e); });
          }
        }

        // Only consider fresh calls
        const freshCalls = data.filter(
          (c) => now - new Date(c.created_at).getTime() <= STALE_THRESHOLD_MS
        );

        if (freshCalls.length > 0 && !incomingCallRef.current && !isConnectedRef.current) {
          const call = freshCalls[0] as ActiveCallData;
          
          // Always show popup immediately — Answer button stays disabled until SDK delivers activeCall
          setIncomingCall(call);
          logCallEventRef.current?.(call.call_sid, 'frontend_acknowledged', call.call_flow_id);
          supabase.from('active_calls').update({ frontend_ack_at: new Date().toISOString() }).eq('id', call.id);
        }
      }
    };
    
    fetchRingingCalls();
    const pollInterval = setInterval(fetchRingingCalls, 5000); // Reduced from 2s
    
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
              logCallEventRef.current?.(call.call_sid, 'realtime_received', call.call_flow_id);
              
              // Always show popup immediately regardless of device registration
              if (!incomingCallRef.current && !isConnectedRef.current) {
                setIncomingCall(call);
                supabase.from('active_calls').update({ frontend_ack_at: new Date().toISOString() }).eq('id', call.id);
              }
            } else if (incomingCallRef.current?.call_sid === call.call_sid && !isConnectedRef.current) {
              if (call.status !== 'ringing') {
                console.log('[CallContext] Call no longer ringing:', call.status);
                setIncomingCall(null);
              }
            }
          }
          
          if (payload.eventType === 'DELETE') {
            const call = payload.old as ActiveCallData;
            if (incomingCallRef.current?.call_sid === call.call_sid && !isConnectedRef.current) {
              setIncomingCall(null);
            }
          }
          
          queryClient.invalidateQueries({ queryKey: ['active-calls-ringing'] });
          queryClient.invalidateQueries({ queryKey: ['evan-active-calls'] });
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
  }, [isEvan, queryClient]); // Stable deps only

  const answerCall = useCallback(async () => {
    if (!incomingCall) throw new Error('No incoming call');

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new Error('Microphone access is required to answer calls.');
    }

    await logCallEvent(incomingCall.call_sid, 'answer_attempted', incomingCall.call_flow_id);

    // Prefer the React-state call object, but also check the SDK's internal call map
    // in case the incoming event fired but React state hasn't propagated yet.
    const sdkCallsDirect = Array.from(deviceRef.current?.calls?.values?.() || []);
    const callToAnswer = activeCall ?? (sdkCallsDirect.length > 0 ? sdkCallsDirect[0] : null);

    // If SDK already has the call object (via state or direct map lookup), accept directly
    if (callToAnswer) {
      callToAnswer.accept();
      if (!activeCall) {
        // State update is in-flight — sync it so the rest of the UI stays consistent
        setActiveCall(callToAnswer);
      }
    } else {
      // SDK didn't deliver the call — use Conference Bridge approach:
      // 1. Redirect the inbound call into a conference room
      // 2. Browser joins the same conference via Device.connect()
      // This works because Device.connect() (outbound) doesn't need the SDK incoming event
      console.log('[CallContext] No SDK activeCall — using Conference Bridge for call', incomingCall.call_sid);

      // 1. Ensure device is initialized (needed for Device.connect)
      const deviceInitPromise = initializeTwilioDevice().catch(err => {
        console.error('[CallContext] Device init failed:', err);
        return null;
      });

      // 2. Get fresh session token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Not authenticated');
      }

      // 3. Call twilio-connect-call — redirects inbound call into a conference room
      console.log('[CallContext] Redirecting inbound call into conference room...');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-connect-call`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ callSid: incomingCall.call_sid }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || 'Failed to redirect call to conference');
      }

      const { conferenceName } = await response.json();
      console.log('[CallContext] Inbound call redirected to conference:', conferenceName);

      // 4. Wait for device to be ready
      const device = await deviceInitPromise ?? deviceRef.current;
      if (!device || device.state !== 'registered') {
        // Last resort: wait briefly for device registration
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 5000);
          const check = setInterval(() => {
            if (deviceRef.current?.state === 'registered') {
              clearTimeout(timeout);
              clearInterval(check);
              resolve();
            }
          }, 200);
        });
      }

      const readyDevice = deviceRef.current;
      if (!readyDevice || readyDevice.state !== 'registered') {
        throw new Error('Phone device not ready. Please try again.');
      }

      // 5. Browser joins the conference via Device.connect (outbound call to conference TwiML)
      console.log('[CallContext] Browser joining conference:', conferenceName);
      await logCallEvent(incomingCall.call_sid, 'conference_join_attempt', incomingCall.call_flow_id, { conferenceName });

      const conferenceCall = await readyDevice.connect({
        params: {
          To: `conference:${conferenceName}`,
        },
      });

      setActiveCall(conferenceCall);

      // Wire up call events
      conferenceCall.on('accept', () => {
        console.log('[CallContext] ✅ Browser joined conference — audio bridge active');
        setIsConnected(true);
        startCallTimer();
        logCallEvent(incomingCall.call_sid, 'conference_joined', incomingCall.call_flow_id);
      });

      conferenceCall.on('disconnect', () => {
        console.log('[CallContext] Conference call disconnected');
        logCallEvent(incomingCall.call_sid, 'call_disconnected', incomingCall.call_flow_id);
        handleCallEnd();
      });

      conferenceCall.on('cancel', () => {
        console.log('[CallContext] Conference call cancelled');
        logCallEvent(incomingCall.call_sid, 'call_cancelled', incomingCall.call_flow_id);
        handleCallEnd();
      });

      conferenceCall.on('error', (error) => {
        console.error('[CallContext] Conference call error:', error);
        logCallEvent(incomingCall.call_sid, 'conference_error', incomingCall.call_flow_id, { error: error.message });
        handleCallEnd();
      });
    }

    const { error } = await supabase
      .from('active_calls')
      .update({
        status: 'in-progress',
        answered_at: new Date().toISOString(),
      })
      .eq('call_sid', incomingCall.call_sid);

    if (error) throw error;
    
    await logCallEvent(incomingCall.call_sid, 'call_answered', incomingCall.call_flow_id);
    toast.success('Call connected!');
  }, [incomingCall, activeCall, initializeTwilioDevice, logCallEvent, startCallTimer, handleCallEnd]);

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
      await supabase.from('communications').insert({
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
