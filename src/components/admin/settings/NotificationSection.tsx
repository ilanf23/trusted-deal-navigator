import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, BellRing, Newspaper } from 'lucide-react';

interface NotificationPreferences {
  email_new_leads: boolean;
  email_task_assignments: boolean;
  email_deal_updates: boolean;
  email_system_alerts: boolean;
  browser_push: boolean;
  daily_digest: boolean;
}

const defaultPreferences: NotificationPreferences = {
  email_new_leads: true,
  email_task_assignments: true,
  email_deal_updates: true,
  email_system_alerts: true,
  browser_push: false,
  daily_digest: false,
};

const NotificationSection = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [initialPreferences, setInitialPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const stored = user.user_metadata?.notification_preferences as NotificationPreferences | undefined;
    if (stored) {
      const merged = { ...defaultPreferences, ...stored };
      setPreferences(merged);
      setInitialPreferences(merged);
    }
  }, [user]);

  const isDirty = JSON.stringify(preferences) !== JSON.stringify(initialPreferences);

  const handleToggle = useCallback((key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { notification_preferences: preferences },
    });
    setSaving(false);

    if (error) {
      toast.error(error.message || 'Failed to save notification preferences');
      return;
    }

    setInitialPreferences(preferences);
    toast.success('Notification preferences saved');
  };

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-medium">Email Notifications</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Choose which email notifications you'd like to receive.
        </p>

        <div className="space-y-4">
          <ToggleRow
            id="email_new_leads"
            label="New leads"
            description="Get notified when a new lead is assigned to you"
            checked={preferences.email_new_leads}
            onToggle={() => handleToggle('email_new_leads')}
          />
          <ToggleRow
            id="email_task_assignments"
            label="Task assignments"
            description="Get notified when you're assigned a new task"
            checked={preferences.email_task_assignments}
            onToggle={() => handleToggle('email_task_assignments')}
          />
          <ToggleRow
            id="email_deal_updates"
            label="Deal updates"
            description="Get notified when a deal you're involved in changes stage"
            checked={preferences.email_deal_updates}
            onToggle={() => handleToggle('email_deal_updates')}
          />
          <ToggleRow
            id="email_system_alerts"
            label="System alerts"
            description="Important system notifications and maintenance alerts"
            checked={preferences.email_system_alerts}
            onToggle={() => handleToggle('email_system_alerts')}
          />
        </div>
      </div>

      <Separator />

      {/* Browser Push Notifications */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-medium">Browser Push Notifications</h3>
        </div>

        <ToggleRow
          id="browser_push"
          label="Enable push notifications"
          description="Receive real-time notifications in your browser even when the app is in the background"
          checked={preferences.browser_push}
          onToggle={() => handleToggle('browser_push')}
        />
      </div>

      <Separator />

      {/* Daily Digest */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-base font-medium">Daily Digest</h3>
        </div>

        <ToggleRow
          id="daily_digest"
          label="Daily summary email"
          description="Receive a daily email summarizing your leads, tasks, and deal activity"
          checked={preferences.daily_digest}
          onToggle={() => handleToggle('daily_digest')}
        />
      </div>

      {/* Save button */}
      <div className="pt-2">
        <Button onClick={handleSave} disabled={saving || !isDirty}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </Button>
      </div>
    </div>
  );
};

// --- Toggle Row ---

const ToggleRow = ({
  id,
  label,
  description,
  checked,
  onToggle,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) => (
  <div className="flex items-center justify-between gap-4">
    <div className="space-y-0.5">
      <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <Switch id={id} checked={checked} onCheckedChange={onToggle} />
  </div>
);

export default NotificationSection;
