import { Mail, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GmailConnectScreenProps {
  variant: 'connect' | 'reauth';
  onConnect: () => void;
  onDisconnect?: () => void;
  isConnecting: boolean;
}

export function GmailConnectScreen({
  variant,
  onConnect,
  onDisconnect,
  isConnecting,
}: GmailConnectScreenProps) {
  if (variant === 'reauth') {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-6">
        <div className="p-6 rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Mail className="h-16 w-16 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Gmail Session Expired</h2>
          <p className="text-muted-foreground max-w-md">
            Your Gmail connection needs to be refreshed. Please reconnect to continue accessing your emails.
          </p>
        </div>
        <div className="flex gap-3">
          {onDisconnect && (
            <Button variant="outline" onClick={onDisconnect}>
              <Trash2 className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          )}
          <Button
            onClick={async () => {
              if (onDisconnect) {
                await onDisconnect();
                setTimeout(onConnect, 500);
              } else {
                onConnect();
              }
            }}
            size="lg"
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reconnecting...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reconnect Gmail
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-6">
      <div className="p-6 rounded-full bg-muted">
        <Mail className="h-16 w-16 text-muted-foreground" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Connect Your Gmail</h2>
        <p className="text-muted-foreground max-w-md">
          Connect your Gmail account to send and receive emails directly from your dashboard.
        </p>
      </div>
      <Button onClick={onConnect} size="lg" disabled={isConnecting}>
        {isConnecting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Connect Gmail
          </>
        )}
      </Button>
    </div>
  );
}
