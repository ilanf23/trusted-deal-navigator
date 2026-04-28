import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useUserPreferences, type UserPreferences } from '@/hooks/useUserPreferences';
import KeyboardShortcutsSection from './KeyboardShortcutsSection';

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

const densityOptions = [
  { value: 'comfortable', label: 'Comfortable', description: 'Roomy spacing.' },
  { value: 'compact', label: 'Compact', description: 'Denser rows, more on-screen.' },
] as const;

const fontSizeOptions = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
] as const;

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Mexico_City',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Madrid',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Dubai',
  'Australia/Sydney',
  'UTC',
];

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g. 04/27/2026)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 27/04/2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g. 2026-04-27)' },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD ($) — US Dollar' },
  { value: 'EUR', label: 'EUR (€) — Euro' },
  { value: 'GBP', label: 'GBP (£) — British Pound' },
  { value: 'CAD', label: 'CAD ($) — Canadian Dollar' },
  { value: 'AUD', label: 'AUD ($) — Australian Dollar' },
];

const LANDING_PAGES = [
  { value: '/admin/dashboard', label: 'Dashboard' },
  { value: '/admin/pipeline/feed', label: 'Pipeline Feed' },
  { value: '/admin/pipeline/potential', label: 'Pipeline — Potential' },
  { value: '/admin/pipeline/underwriting', label: 'Pipeline — Underwriting' },
  { value: '/admin/contacts/people', label: 'People' },
  { value: '/admin/tasks', label: "To Do's" },
  { value: '/admin/calendar', label: 'Calendar' },
  { value: '/admin/gmail', label: 'Gmail' },
];

const SectionHeading = ({ title, description }: { title: string; description?: string }) => (
  <div>
    <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
    {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
  </div>
);

const PreferencesSection = () => {
  const { theme, setTheme } = useTheme();
  const { settings, preferences, isLoading, update } = useUserPreferences();
  const [local, setLocal] = useState<UserPreferences>(preferences);
  const [tzLocal, setTzLocal] = useState<string>('America/Chicago');
  const [dfLocal, setDfLocal] = useState<string>('MM/DD/YYYY');
  const [tfLocal, setTfLocal] = useState<string>('12');
  const [curLocal, setCurLocal] = useState<string>('USD');

  useEffect(() => {
    setLocal(preferences);
    if (settings) {
      setTzLocal(settings.timezone || 'America/Chicago');
      setDfLocal(settings.date_format || 'MM/DD/YYYY');
      setTfLocal(settings.time_format || '12');
      setCurLocal(settings.currency || 'USD');
    }
  }, [preferences, settings]);

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        preferences: local,
        timezone: tzLocal,
        date_format: dfLocal,
        time_format: tfLocal,
        currency: curLocal,
      });
      toast.success('Preferences saved');
    } catch {
      toast.error('Failed to save preferences');
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
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Preferences</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personalize how the app looks and behaves for you.
        </p>
      </div>

      {/* Display */}
      <section className="space-y-5">
        <SectionHeading title="Display" />

        <div>
          <Label className="text-sm font-medium">Theme</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = (theme ?? 'system') === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-colors cursor-pointer',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full',
                      isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">{option.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">Density</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {densityOptions.map((opt) => {
              const selected = local.density === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setLocal({ ...local, density: opt.value })}
                  className={cn(
                    'rounded-lg border-2 p-4 text-left transition-colors',
                    selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                  )}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-w-xs">
          <Label className="text-sm font-medium">Font size</Label>
          <Select
            value={local.font_size ?? 'medium'}
            onValueChange={(v) => setLocal({ ...local, font_size: v as UserPreferences['font_size'] })}
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fontSizeOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <Separator />

      {/* Localization */}
      <section className="space-y-5">
        <SectionHeading title="Localization" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Time zone</Label>
            <Select value={tzLocal} onValueChange={setTzLocal}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Date format</Label>
            <Select value={dfLocal} onValueChange={setDfLocal}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Time format</Label>
            <Select value={tfLocal} onValueChange={setTfLocal}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12-hour (1:30 PM)</SelectItem>
                <SelectItem value="24">24-hour (13:30)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Currency</Label>
            <Select value={curLocal} onValueChange={setCurLocal}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Language</Label>
            <Select value="en" disabled>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="English" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">More languages coming soon.</p>
          </div>
          <div>
            <Label className="text-sm font-medium">First day of week</Label>
            <Select
              value={local.first_day_of_week ?? 'sunday'}
              onValueChange={(v) => setLocal({ ...local, first_day_of_week: v as UserPreferences['first_day_of_week'] })}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sunday">Sunday</SelectItem>
                <SelectItem value="monday">Monday</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <Separator />

      {/* Default views */}
      <section className="space-y-5">
        <SectionHeading title="Default views" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Landing page after login</Label>
            <Select
              value={local.default_landing ?? '/admin/dashboard'}
              onValueChange={(v) => setLocal({ ...local, default_landing: v })}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANDING_PAGES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Default pipeline view</Label>
            <Select
              value={local.default_pipeline_view ?? 'board'}
              onValueChange={(v) => setLocal({ ...local, default_pipeline_view: v as 'board' | 'list' })}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="board">Board</SelectItem>
                <SelectItem value="list">List</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Default calendar view</Label>
            <Select
              value={local.default_calendar_view ?? 'week'}
              onValueChange={(v) => setLocal({ ...local, default_calendar_view: v as 'day' | 'week' | 'month' })}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <Separator />

      {/* Keyboard shortcuts */}
      <section className="space-y-4">
        <SectionHeading title="Keyboard shortcuts" />
        <div className="flex items-center justify-between rounded-md border border-border p-4">
          <div>
            <p className="text-sm font-medium">Enable keyboard shortcuts</p>
            <p className="text-xs text-muted-foreground mt-0.5">Use single-key and modifier shortcuts throughout the app.</p>
          </div>
          <Switch
            checked={local.shortcuts_enabled ?? true}
            onCheckedChange={(v) => setLocal({ ...local, shortcuts_enabled: v })}
          />
        </div>
        <KeyboardShortcutsSection />
      </section>

      <div className="sticky bottom-0 bg-background pt-4 -mx-8 px-8 pb-2 border-t border-border">
        <Button onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save preferences'
          )}
        </Button>
      </div>
    </div>
  );
};

export default PreferencesSection;
