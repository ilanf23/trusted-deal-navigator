import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMember } from '@/hooks/useTeamMember';
import { toast } from 'sonner';
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns';

export interface Appointment {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  lead_id: string | null;
  appointment_type: string | null;
  google_event_id: string | null;
  sync_status: string | null;
}

export interface TaskItem {
  id: string;
  title: string;
  due_date: string;
  is_completed: boolean;
  priority: string | null;
  status: string | null;
  lead?: { name: string; company_name: string | null } | null;
}

export type ViewMode = 'day' | 'week' | 'month' | 'agenda';

export interface CalendarFilter {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
}

const getCalendarCallbackUrl = () => {
  const prefix = window.location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
  return `${window.location.origin}${prefix}/calendar-callback`;
};

export function useCalendarData(viewMode: ViewMode, currentDate: Date) {
  const { teamMember } = useTeamMember();
  const queryClient = useQueryClient();

  const [calendarStatus, setCalendarStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [calendarFilters, setCalendarFilters] = useState<CalendarFilter[]>([
    { id: 'appointments', label: 'Appointments', color: 'bg-blue-500', enabled: true },
    { id: 'tasks', label: 'To-Dos', color: 'bg-amber-500', enabled: true },
    { id: 'google', label: 'Google Calendar', color: 'bg-green-500', enabled: true },
  ]);

  const toggleFilter = (filterId: string) => {
    setCalendarFilters(prev =>
      prev.map(f => (f.id === filterId ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const showAppointments = calendarFilters.find(f => f.id === 'appointments')?.enabled ?? true;
  const showTasks = calendarFilters.find(f => f.id === 'tasks')?.enabled ?? true;

  const getDateRange = useCallback(() => {
    switch (viewMode) {
      case 'day':
        return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
      case 'week':
        return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
      case 'month':
      case 'agenda':
      default: {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        return { start: startOfWeek(monthStart), end: endOfWeek(monthEnd) };
      }
    }
  }, [viewMode, currentDate]);

  const checkCalendarStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'getStatus' },
      });

      if (!error && data) {
        setCalendarStatus(data);
      }
    } catch (err) {
      console.error('Failed to check calendar status:', err);
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_CALENDAR_CONNECTED') {
        setCalendarStatus({ connected: true, email: event.data.email });
        setIsConnecting(false);
        toast.success(`Google Calendar connected: ${event.data.email}`);
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
      } else if (event.data?.type === 'GOOGLE_CALENDAR_ERROR') {
        setIsConnecting(false);
        toast.error('Failed to connect Google Calendar');
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'google-calendar-auth-result' && event.newValue) {
        try {
          const result = JSON.parse(event.newValue);
          if (result.timestamp && Date.now() - result.timestamp < 30000) {
            if (result.type === 'GOOGLE_CALENDAR_CONNECTED') {
              setCalendarStatus({ connected: true, email: result.email });
              setIsConnecting(false);
              toast.success(`Google Calendar connected: ${result.email}`);
              queryClient.invalidateQueries({ queryKey: ['appointments'] });
            } else if (result.type === 'GOOGLE_CALENDAR_ERROR') {
              setIsConnecting(false);
              toast.error('Failed to connect Google Calendar');
            }
            localStorage.removeItem('google-calendar-auth-result');
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    const checkExistingResult = () => {
      const stored = localStorage.getItem('google-calendar-auth-result');
      if (stored) {
        try {
          const result = JSON.parse(stored);
          if (result.timestamp && Date.now() - result.timestamp < 30000) {
            if (result.type === 'GOOGLE_CALENDAR_CONNECTED') {
              setCalendarStatus({ connected: true, email: result.email });
              setIsConnecting(false);
              toast.success(`Google Calendar connected: ${result.email}`);
              queryClient.invalidateQueries({ queryKey: ['appointments'] });
            }
            localStorage.removeItem('google-calendar-auth-result');
          }
        } catch {
          // Ignore
        }
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorageChange);
    checkCalendarStatus();
    checkExistingResult();

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [checkCalendarStatus, queryClient]);

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery({
    queryKey: ['appointments', teamMember?.id, viewMode, currentDate.toISOString()],
    queryFn: async () => {
      const { start, end } = getDateRange();
      let query = supabase
        .from('appointments')
        .select('*')
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time', { ascending: true });
      if (teamMember?.id) {
        query = query.eq('team_member_id', teamMember.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!teamMember?.id,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks-calendar', teamMember?.id, viewMode, currentDate.toISOString()],
    queryFn: async () => {
      const { start, end } = getDateRange();
      let query = supabase
        .from('tasks')
        .select('id, title, due_date, is_completed, priority, status, lead:pipeline(name, company_name)')
        .not('due_date', 'is', null)
        .gte('due_date', start.toISOString())
        .lte('due_date', end.toISOString())
        .order('due_date', { ascending: true });
      if (teamMember?.id) {
        query = query.eq('team_member_id', teamMember.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as TaskItem[];
    },
    enabled: !!teamMember?.id,
  });

  const isLoading = appointmentsLoading || tasksLoading;

  const addAppointment = useMutation({
    mutationFn: async (appt: {
      title: string;
      start_time: string;
      end_time: string;
      appointment_type: string;
      description?: string;
      lead_id?: string | null;
    }) => {
      const { error } = await supabase
        .from('appointments')
        .insert({
          title: appt.title,
          start_time: appt.start_time,
          end_time: appt.end_time,
          appointment_type: appt.appointment_type,
          description: appt.description ?? null,
          lead_id: appt.lead_id ?? null,
          team_member_id: teamMember?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment added');
    },
    onError: () => toast.error('Failed to add appointment'),
  });

  const updateAppointment = useMutation({
    mutationFn: async (appt: {
      id: string;
      title?: string;
      start_time?: string;
      end_time?: string;
      appointment_type?: string;
      description?: string | null;
      lead_id?: string | null;
    }) => {
      const { id, ...updates } = appt;
      const { error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment updated');
    },
    onError: () => toast.error('Failed to update appointment'),
  });

  const deleteAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment deleted');
    },
  });

  const connectCalendar = async () => {
    setIsConnecting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please log in to connect Google Calendar');
      setIsConnecting(false);
      return;
    }

    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      '',
      'google-calendar-auth',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );

    if (!popup || popup.closed) {
      toast.error('Popup blocked. Please allow popups for this site.');
      setIsConnecting(false);
      return;
    }

    popup.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connecting to Google Calendar...</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .spinner {
              width: 40px;
              height: 40px;
              border: 3px solid rgba(255,255,255,0.3);
              border-radius: 50%;
              border-top-color: white;
              animation: spin 1s ease-in-out infinite;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            p { margin-top: 20px; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <p>Connecting to Google Calendar...</p>
        </body>
      </html>
    `);

    try {
      const callbackUrl = getCalendarCallbackUrl();
      localStorage.setItem('calendarCallbackUrl', callbackUrl);

      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'getAuthUrl',
          redirectUri: callbackUrl,
        },
      });

      if (error) throw error;
      if (!data?.authUrl) throw new Error('Missing authUrl');

      popup.location.href = data.authUrl;

      const pollTimer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(pollTimer);
          setIsConnecting(false);
        }
      }, 500);
    } catch (err) {
      console.error('Failed to get auth URL:', err);
      try {
        popup.close();
      } catch {
        // ignore
      }
      toast.error('Failed to connect Google Calendar');
      setIsConnecting(false);
    }
  };

  const disconnectCalendar = async () => {
    try {
      const { error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'disconnect' },
      });

      if (error) throw error;

      setCalendarStatus({ connected: false });
      toast.success('Google Calendar disconnected');
    } catch (err) {
      console.error('Failed to disconnect:', err);
      toast.error('Failed to disconnect calendar');
    }
  };

  const syncToGoogle = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'syncAll' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success(`Synced ${data.synced} appointments to Google Calendar`);
    },
    onError: () => toast.error('Failed to sync to Google Calendar'),
  });

  const importFromGoogle = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'importFromGoogle' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success(`Imported ${data.imported} new, updated ${data.updated} appointments`);
    },
    onError: () => toast.error('Failed to import from Google Calendar'),
  });

  const isSyncing = syncToGoogle.isPending || importFromGoogle.isPending;

  return {
    teamMember,
    appointments,
    tasks,
    isLoading,
    calendarStatus,
    isConnecting,
    calendarFilters,
    toggleFilter,
    showAppointments,
    showTasks,
    addAppointment,
    updateAppointment,
    deleteAppointment,
    connectCalendar,
    disconnectCalendar,
    syncToGoogle,
    importFromGoogle,
    isSyncing,
    getDateRange,
  };
}
