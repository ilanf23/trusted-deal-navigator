import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserPreferences {
  density?: 'comfortable' | 'compact';
  font_size?: 'small' | 'medium' | 'large';
  first_day_of_week?: 'sunday' | 'monday';
  default_landing?: string;
  default_pipeline_view?: 'board' | 'list';
  default_calendar_view?: 'day' | 'week' | 'month';
  shortcuts_enabled?: boolean;
  // Notifications
  pause_until?: string | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  email_digest?: 'daily' | 'weekly' | 'off';
  // Saved task filters
  default_task_filter_id?: string | null;
}

export interface UserSettings {
  id: string;
  preferences: UserPreferences;
  notification_preferences: Record<string, { in_app?: boolean; email?: boolean; push?: boolean }>;
  email_signature: string | null;
  timezone: string | null;
  date_format: string | null;
  time_format: string | null;
  currency: string | null;
  language: string | null;
}

const DEFAULTS: UserPreferences = {
  density: 'comfortable',
  font_size: 'medium',
  first_day_of_week: 'sunday',
  default_landing: '/admin/dashboard',
  default_pipeline_view: 'board',
  default_calendar_view: 'week',
  shortcuts_enabled: true,
  email_digest: 'off',
};

export const useUserPreferences = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async (): Promise<UserSettings | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('users')
        .select('id, preferences, notification_preferences, email_signature, timezone, date_format, time_format, currency, language')
        .eq('id', user.id)
        .maybeSingle();
      if (error || !data) return null;
      return {
        ...data,
        preferences: { ...DEFAULTS, ...((data.preferences as UserPreferences | null) ?? {}) },
        notification_preferences: (data.notification_preferences as UserSettings['notification_preferences']) ?? {},
      } as UserSettings;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });

  const update = useMutation({
    mutationFn: async (
      patch: Partial<{
        preferences: UserPreferences;
        notification_preferences: UserSettings['notification_preferences'];
        email_signature: string;
        timezone: string;
        date_format: string;
        time_format: string;
        currency: string;
        language: string;
      }>,
    ) => {
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase.from('users').update(patch).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings', user?.id] });
    },
  });

  return {
    settings: data,
    preferences: data?.preferences ?? DEFAULTS,
    isLoading,
    update,
  };
};
