import { useCall } from '@/contexts/CallContext';
import { Phone, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Small indicator showing call system health status.
 * Shows in the header when Evan is logged in.
 */
export const CallHealthIndicator = () => {
  const { healthStatus, isEvan, isInitializing } = useCall();
  
  if (!isEvan) return null;

  const isHealthy = healthStatus.deviceReady && healthStatus.socketConnected;
  const isPartial = healthStatus.deviceReady || healthStatus.socketConnected;

  const getStatusColor = () => {
    if (isInitializing) return 'text-yellow-500';
    if (isHealthy) return 'text-green-500';
    if (isPartial) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusText = () => {
    if (isInitializing) return 'Connecting...';
    if (isHealthy) return 'Ready to receive calls';
    if (healthStatus.deviceReady && !healthStatus.socketConnected) {
      return 'Phone ready, realtime reconnecting...';
    }
    if (!healthStatus.deviceReady && healthStatus.socketConnected) {
      return 'Realtime connected, phone reconnecting...';
    }
    return 'Call system offline - reconnecting...';
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors',
          isHealthy ? 'bg-green-500/10' : isPartial ? 'bg-yellow-500/10' : 'bg-red-500/10'
        )}>
          {isInitializing ? (
            <Phone className={cn('w-3.5 h-3.5 animate-pulse', getStatusColor())} />
          ) : isHealthy ? (
            <Wifi className={cn('w-3.5 h-3.5', getStatusColor())} />
          ) : isPartial ? (
            <AlertTriangle className={cn('w-3.5 h-3.5', getStatusColor())} />
          ) : (
            <WifiOff className={cn('w-3.5 h-3.5', getStatusColor())} />
          )}
          <span className={getStatusColor()}>
            {isHealthy ? 'Online' : isInitializing ? 'Connecting' : 'Offline'}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1.5">
          <p className="font-medium">{getStatusText()}</p>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={healthStatus.deviceReady ? 'text-green-500' : 'text-red-500'}>●</span>
              <span>Twilio Device: {healthStatus.deviceReady ? 'Ready' : 'Not Ready'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={healthStatus.socketConnected ? 'text-green-500' : 'text-red-500'}>●</span>
              <span>Realtime: {healthStatus.socketConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            {healthStatus.lastHeartbeat && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">●</span>
                <span>Last sync: {new Date(healthStatus.lastHeartbeat).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
