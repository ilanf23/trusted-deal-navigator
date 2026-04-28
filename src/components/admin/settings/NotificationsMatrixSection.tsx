import { Fragment, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useUserPreferences } from '@/hooks/useUserPreferences';

type Channel = 'in_app' | 'email' | 'push';
type EventPrefs = Partial<Record<Channel, boolean>>;
type AllPrefs = Record<string, EventPrefs>;

interface EventDef {
  key: string;
  label: string;
}

interface CategoryDef {
  category: string;
  events: EventDef[];
}

const CATEGORIES: CategoryDef[] = [
  {
    category: 'Tasks',
    events: [
      { key: 'task_assigned', label: 'New task assigned to me' },
      { key: 'task_due_today', label: 'Task due today' },
      { key: 'task_overdue', label: 'Task overdue' },
      { key: 'task_completed', label: 'Task I created was completed' },
    ],
  },
  {
    category: 'Deals',
    events: [
      { key: 'deal_stage_changed', label: 'Deal stage changed' },
      { key: 'deal_value_updated', label: 'Deal value updated' },
      { key: 'deal_won_lost', label: 'Deal marked Won / Lost' },
      { key: 'deal_assigned', label: 'Deal assigned to me' },
      { key: 'deal_comment', label: 'New comment on a deal I follow' },
    ],
  },
  {
    category: 'People & Companies',
    events: [
      { key: 'person_added', label: 'New person added to my pipeline' },
      { key: 'person_assigned', label: 'Person / company assigned to me' },
      { key: 'tag_added', label: 'Tag added to person / company I follow' },
    ],
  },
  {
    category: 'Email',
    events: [
      { key: 'email_from_tracked', label: 'New email from a tracked contact' },
      { key: 'email_reply', label: 'Email reply received' },
      { key: 'email_opened', label: 'Email opened (tracked send)' },
    ],
  },
  {
    category: 'Calls',
    events: [
      { key: 'missed_call', label: 'Missed inbound call' },
      { key: 'voicemail', label: 'New voicemail' },
      { key: 'call_summary', label: 'Call summary ready' },
    ],
  },
  {
    category: 'Calendar',
    events: [
      { key: 'meeting_starting', label: 'Meeting starting in 15 min' },
      { key: 'meeting_response', label: 'Meeting accepted / declined' },
      { key: 'meeting_booked', label: 'New meeting booked' },
    ],
  },
  {
    category: 'Mentions & Comments',
    events: [
      { key: 'mention', label: "I'm mentioned in a comment" },
      { key: 'comment_reply', label: 'Reply to my comment' },
    ],
  },
  {
    category: 'System',
    events: [
      { key: 'user_joined', label: 'New user joined workspace' },
      { key: 'integration_disconnected', label: 'Integration disconnected' },
      { key: 'weekly_digest', label: 'Weekly summary digest' },
    ],
  },
];

const allEvents = CATEGORIES.flatMap((c) => c.events.map((e) => e.key));

const NotificationsMatrixSection = () => {
  const { settings, update, isLoading } = useUserPreferences();
  const [prefs, setPrefs] = useState<AllPrefs>({});
  const [pauseAll, setPauseAll] = useState(false);
  const [pauseUntil, setPauseUntil] = useState<string>('');
  const [quietStart, setQuietStart] = useState('21:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [emailDigest, setEmailDigest] = useState<'daily' | 'weekly' | 'off'>('off');
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );

  useEffect(() => {
    if (!settings) return;
    // Initialize all events to true if no record yet
    const initial: AllPrefs = {};
    for (const key of allEvents) {
      const existing = settings.notification_preferences[key];
      initial[key] = {
        in_app: existing?.in_app ?? true,
        email: existing?.email ?? true,
        push: existing?.push ?? false,
      };
    }
    setPrefs(initial);
    if (settings.preferences) {
      setPauseUntil((settings.preferences.pause_until as string) ?? '');
      setQuietStart((settings.preferences.quiet_hours_start as string) ?? '21:00');
      setQuietEnd((settings.preferences.quiet_hours_end as string) ?? '07:00');
      setEmailDigest((settings.preferences.email_digest as 'daily' | 'weekly' | 'off') ?? 'off');
      setPauseAll(!!settings.preferences.pause_until);
    }
  }, [settings]);

  const toggle = (key: string, channel: Channel) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [channel]: !prev[key]?.[channel],
      },
    }));
  };

  const requestPushPermission = async () => {
    if (typeof Notification === 'undefined') {
      toast.error('Push notifications not supported by this browser');
      return;
    }
    const result = await Notification.requestPermission();
    setPushPermission(result);
    if (result === 'granted') toast.success('Push notifications enabled');
  };

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        notification_preferences: prefs,
        preferences: {
          ...(settings?.preferences ?? {}),
          pause_until: pauseAll ? pauseUntil : null,
          quiet_hours_start: quietStart,
          quiet_hours_end: quietEnd,
          email_digest: emailDigest,
        },
      });
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">Choose what you're notified about and where.</p>
      </div>

      {/* Top controls */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-md border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Pause all notifications</Label>
            <Switch checked={pauseAll} onCheckedChange={setPauseAll} />
          </div>
          {pauseAll && (
            <Select value={pauseUntil} onValueChange={setPauseUntil}>
              <SelectTrigger>
                <SelectValue placeholder="Until when?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1 hour</SelectItem>
                <SelectItem value="4h">4 hours</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="indefinite">Until I turn back on</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="rounded-md border border-border p-4 space-y-2">
          <Label className="text-sm font-medium">Quiet hours</Label>
          <div className="flex items-center gap-2">
            <Input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} className="w-24" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} className="w-24" />
          </div>
          <p className="text-[11px] text-muted-foreground">Non-urgent notifications batch into a digest.</p>
        </div>

        <div className="rounded-md border border-border p-4 space-y-2">
          <Label className="text-sm font-medium">Email digest</Label>
          <Select value={emailDigest} onValueChange={(v) => setEmailDigest(v as 'daily' | 'weekly' | 'off')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <Separator />

      {/* Matrix */}
      <section className="space-y-3">
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#eee6f6] text-[#3b2778]">
              <tr>
                <th className="text-left px-4 py-2 font-semibold w-2/5">Event</th>
                <th className="px-4 py-2 font-semibold text-center">In-App</th>
                <th className="px-4 py-2 font-semibold text-center">Email</th>
                <th className="px-4 py-2 font-semibold text-center">
                  Push
                  {pushPermission !== 'granted' && (
                    <button
                      onClick={requestPushPermission}
                      className="ml-2 text-[10px] uppercase tracking-wide font-semibold text-blue-600 hover:underline"
                    >
                      Enable
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => (
                <Fragment key={cat.category}>
                  <tr className="bg-muted/40">
                    <td colSpan={4} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {cat.category}
                    </td>
                  </tr>
                  {cat.events.map((evt) => (
                    <tr key={evt.key} className="border-t border-border">
                      <td className="px-4 py-2">{evt.label}</td>
                      {(['in_app', 'email', 'push'] as Channel[]).map((ch) => (
                        <td key={ch} className="px-4 py-2 text-center">
                          <Switch
                            checked={!!prefs[evt.key]?.[ch]}
                            onCheckedChange={() => toggle(evt.key, ch)}
                            disabled={ch === 'push' && pushPermission !== 'granted'}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Mobile push requires the mobile app — coming soon. Browser push requires permission per device.
        </p>
      </section>

      <div className="sticky bottom-0 bg-background pt-4 -mx-8 px-8 pb-2 border-t border-border">
        <Button onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save notifications'
          )}
        </Button>
      </div>
    </div>
  );
};

export default NotificationsMatrixSection;
