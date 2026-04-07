import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Globe, Clock, Calendar, LogOut, Monitor } from 'lucide-react';

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  return 'Unknown Browser';
};

const getOSInfo = () => {
  const ua = navigator.userAgent;
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Android')) return 'Android';
  return 'Unknown OS';
};

const SessionSection = () => {
  const { user, session } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOutAllDevices = async () => {
    if (!window.confirm('Are you sure you want to sign out of all devices? You will need to sign in again on each device.')) {
      return;
    }

    setSigningOut(true);
    const { error } = await supabase.auth.signOut({ scope: 'global' });

    if (error) {
      setSigningOut(false);
      toast.error(error.message || 'Failed to sign out of all devices');
      return;
    }

    // Component will unmount from auth redirect — no further state updates needed
    toast.success('Signed out of all devices. You will be redirected to the login page.');
  };

  const createdAt = user?.created_at;
  const lastSignIn = user?.last_sign_in_at;

  return (
    <div className="space-y-6">
      {/* Current Session */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Monitor className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-medium">Current Session</h3>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Browser</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {getBrowserInfo()} on {getOSInfo()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Session started</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {session?.expires_at && session?.expires_in
                ? formatDate(new Date((session.expires_at - session.expires_in) * 1000).toISOString())
                : formatDate(user?.last_sign_in_at)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium ml-6">Status</span>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:text-green-400 dark:border-green-800 dark:bg-green-950">
              Active
            </Badge>
          </div>
        </div>
      </div>

      <Separator />

      {/* Account Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-medium">Account Information</h3>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Account created</span>
            <span className="text-sm text-muted-foreground">{formatDate(createdAt)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Last sign-in</span>
            <span className="text-sm text-muted-foreground">{formatDate(lastSignIn)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Email</span>
            <span className="text-sm text-muted-foreground">{user?.email ?? 'Unknown'}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Sign Out All Devices */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <LogOut className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-medium">Sign Out Everywhere</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Sign out of all devices and sessions. You will need to sign in again on each device.
        </p>

        <Button
          variant="destructive"
          onClick={handleSignOutAllDevices}
          disabled={signingOut}
        >
          {signingOut ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing out...
            </>
          ) : (
            <>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out all devices
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default SessionSection;
