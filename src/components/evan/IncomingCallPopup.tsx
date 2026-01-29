import { useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, User, Mic, MicOff, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCall } from '@/contexts/CallContext';

/**
 * Floating popup that displays incoming/active call UI.
 * Uses the global CallContext so call state persists across page navigation.
 */
export const IncomingCallPopup = () => {
  const {
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
  } = useCall();

  const answerMutation = useMutation({
    mutationFn: answerCall,
    onError: (error: Error) => {
      // Toast is handled in context
      console.error('Failed to answer call:', error.message);
    },
  });

  const hangupMutation = useMutation({
    mutationFn: hangupCall,
    onError: (error: Error) => {
      console.error('Failed to end call:', error.message);
    },
  });

  const declineMutation = useMutation({
    mutationFn: declineCall,
    onError: (error: Error) => {
      console.error('Failed to decline call:', error.message);
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Only show popup for Evan when there's a call
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
                    onClick={() => hangupMutation.mutate()}
                    disabled={hangupMutation.isPending}
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
                    onClick={() => declineMutation.mutate()}
                    disabled={declineMutation.isPending}
                  >
                    <PhoneOff className="h-4 w-4 mr-2" />
                    Decline
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => answerMutation.mutate()}
                    disabled={answerMutation.isPending || isInitializing || !activeCall}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    {isInitializing ? 'Connecting...' : !activeCall ? 'Waiting...' : 'Answer'}
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
