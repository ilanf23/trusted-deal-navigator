import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarIcon, Plus, Phone, Video, Users, Clock, Trash2, RefreshCw, Link2, Unlink, Loader2, Check, ChevronLeft, ChevronRight, List, Grid3X3, CalendarDays, CheckSquare, PanelLeftClose, PanelLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
import { 
  format, 
  isToday, 
  isTomorrow, 
  addDays, 
  addMonths, 
  subMonths,
  startOfDay, 
  endOfDay, 
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  parseISO
} from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

const getCalendarCallbackUrl = () => {
  const prefix = window.location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
  return `${window.location.origin}${prefix}/calendar-callback`;
};

interface Appointment {
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

interface TaskItem {
  id: string;
  title: string;
  due_date: string;
  is_completed: boolean;
  priority: string | null;
  status: string | null;
  lead?: { name: string; company_name: string | null } | null;
}

type CalendarItem = 
  | (Appointment & { itemType: 'appointment' })
  | (TaskItem & { itemType: 'task' });

type ViewMode = 'day' | 'week' | 'month' | 'agenda';

// Calendar visibility filters
interface CalendarFilter {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
}

export const CalendarWidget = () => {
  const { teamMember } = useTeamMember();
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [newAppointment, setNewAppointment] = useState({
    title: '',
    start_time: '',
    appointment_type: 'call',
    duration: '30', // Duration in minutes
  });
  const [calendarStatus, setCalendarStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [calendarFilters, setCalendarFilters] = useState<CalendarFilter[]>([
    { id: 'appointments', label: 'Appointments', color: 'bg-primary', enabled: true },
    { id: 'tasks', label: 'To-Dos', color: 'bg-amber-500', enabled: true },
  ]);
  const queryClient = useQueryClient();

  const toggleFilter = (filterId: string) => {
    setCalendarFilters(prev => 
      prev.map(f => f.id === filterId ? { ...f, enabled: !f.enabled } : f)
    );
  };

  const showAppointments = calendarFilters.find(f => f.id === 'appointments')?.enabled ?? true;
  const showTasks = calendarFilters.find(f => f.id === 'tasks')?.enabled ?? true;

  // Check Google Calendar connection status
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

  // Listen for popup OAuth completion via postMessage and localStorage
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

    // Also listen for localStorage changes (fallback for cross-origin popups)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'google-calendar-auth-result' && event.newValue) {
        try {
          const result = JSON.parse(event.newValue);
          // Only process if it's recent (within last 30 seconds)
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
            // Clean up
            localStorage.removeItem('google-calendar-auth-result');
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    // Also check localStorage on mount (in case popup already completed)
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

  // Calculate date range based on viewMode
  const getDateRange = useCallback(() => {
    switch (viewMode) {
      case 'day':
        return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
      case 'week':
        return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
      case 'month':
      case 'agenda':
      default:
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    }
  }, [viewMode, currentDate]);

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

  // Fetch tasks with due dates for calendar display
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks-calendar', teamMember?.id, viewMode, currentDate.toISOString()],
    queryFn: async () => {
      const { start, end } = getDateRange();

      let query = supabase
        .from('tasks')
        .select('id, title, due_date, is_completed, priority, status, lead:leads(name, company_name)')
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
    mutationFn: async () => {
      const startTime = new Date(newAppointment.start_time);
      const durationMinutes = parseInt(newAppointment.duration, 10) || 30;
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
      
      const { error } = await supabase
        .from('appointments')
        .insert({
          title: newAppointment.title,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          appointment_type: newAppointment.appointment_type,
          team_member_id: teamMember?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setNewAppointment({ title: '', start_time: '', appointment_type: 'call', duration: '30' });
      setIsOpen(false);
      toast.success('Appointment added');
    },
    onError: () => toast.error('Failed to add appointment'),
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

    // First, verify the user has an active session before doing anything
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please log in to connect Google Calendar');
      setIsConnecting(false);
      return;
    }

    // Open the popup IMMEDIATELY and SYNCHRONOUSLY to avoid popup blockers
    // This must happen before any async operation
    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Create popup with a loading message immediately
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

    // Write a loading message to the popup immediately
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
      console.info('[Google Calendar OAuth] redirectUri:', callbackUrl);
      
      // Store the callback URL for the CalendarCallback page to use
      localStorage.setItem('calendarCallbackUrl', callbackUrl);
      
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'getAuthUrl',
          redirectUri: callbackUrl,
        },
      });

      if (error) throw error;
      if (!data?.authUrl) throw new Error('Missing authUrl');

      // Navigate the already-open popup to Google OAuth
      popup.location.href = data.authUrl;

      // Poll to check if popup is closed (user cancelled)
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

  const getTypeIcon = (type: string | null) => {
    switch (type) {
      case 'call': return <Phone className="h-3 w-3" />;
      case 'video': return <Video className="h-3 w-3" />;
      case 'meeting': return <Users className="h-3 w-3" />;
      default: return <CalendarIcon className="h-3 w-3" />;
    }
  };

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMM d');
  };

  // Get appointments for a specific day (filtered)
  const getAppointmentsForDay = (day: Date) => {
    if (!showAppointments) return [];
    return appointments.filter(apt => isSameDay(parseISO(apt.start_time), day));
  };

  // Get tasks for a specific day (filtered)
  const getTasksForDay = (day: Date) => {
    if (!showTasks) return [];
    return tasks.filter(task => task.due_date && isSameDay(parseISO(task.due_date), day));
  };

  // Get all items (appointments + tasks) for a specific day (filtered)
  const getItemsForDay = (day: Date): CalendarItem[] => {
    const dayAppointments = showAppointments 
      ? getAppointmentsForDay(day).map(apt => ({ ...apt, itemType: 'appointment' as const }))
      : [];
    const dayTasks = showTasks 
      ? getTasksForDay(day).map(task => ({ ...task, itemType: 'task' as const }))
      : [];
    return [...dayAppointments, ...dayTasks];
  };

  // Generate calendar days for month view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Generate week days for week view
  const weekStart = startOfWeek(currentDate);
  const weekEnd = endOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const navigatePrev = () => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(addDays(currentDate, -1));
        break;
      case 'week':
        setCurrentDate(addDays(currentDate, -7));
        break;
      case 'month':
      case 'agenda':
      default:
        setCurrentDate(subMonths(currentDate, 1));
        break;
    }
  };

  const navigateNext = () => {
    switch (viewMode) {
      case 'day':
        setCurrentDate(addDays(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(addDays(currentDate, 7));
        break;
      case 'month':
      case 'agenda':
      default:
        setCurrentDate(addMonths(currentDate, 1));
        break;
    }
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  const groupedAppointments = showAppointments 
    ? appointments.reduce((acc, apt) => {
        const dateKey = format(new Date(apt.start_time), 'yyyy-MM-dd');
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(apt);
        return acc;
      }, {} as Record<string, Appointment[]>)
    : {};

  // Group tasks by due date (filtered)
  const groupedTasks = showTasks 
    ? tasks.reduce((acc, task) => {
        if (!task.due_date) return acc;
        const dateKey = format(new Date(task.due_date), 'yyyy-MM-dd');
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(task);
        return acc;
      }, {} as Record<string, TaskItem[]>)
    : {};

  // Get all unique dates that have either appointments or tasks
  const allDatesWithItems = [...new Set([...Object.keys(groupedAppointments), ...Object.keys(groupedTasks)])].sort();

  const isSyncing = syncToGoogle.isPending || importFromGoogle.isPending;

  // Render Month View
  const renderMonthView = () => (
    <div className="space-y-2">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map(day => {
          const dayAppointments = getAppointmentsForDay(day);
          const dayTasks = getTasksForDay(day);
          const totalItems = dayAppointments.length + dayTasks.length;
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          
          return (
            <div
              key={day.toISOString()}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className={cn(
                "min-h-[72px] p-1 border rounded-md cursor-pointer transition-colors",
                !isCurrentMonth && "opacity-40",
                isToday(day) && "border-primary",
                isSelected && "bg-primary/10 border-primary",
                "hover:bg-accent/50"
              )}
            >
              <div className={cn(
                "text-xs font-medium mb-1",
                isToday(day) && "text-primary font-bold"
              )}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {/* Show appointments */}
                {dayAppointments.slice(0, 1).map(apt => (
                  <div
                    key={apt.id}
                    className="text-[10px] bg-primary/20 text-primary rounded px-1 py-0.5 truncate flex items-center gap-1"
                  >
                    {getTypeIcon(apt.appointment_type)}
                    <span className="truncate">{apt.title}</span>
                  </div>
                ))}
                {/* Show tasks */}
                {dayTasks.slice(0, dayAppointments.length > 0 ? 1 : 2).map(task => (
                  <div
                    key={task.id}
                    className={cn(
                      "text-[10px] rounded px-1 py-0.5 truncate flex items-center gap-1",
                      task.is_completed 
                        ? "bg-emerald-500/20 text-emerald-600 line-through opacity-60"
                        : "bg-amber-500/20 text-amber-600"
                    )}
                  >
                    <CheckSquare className="h-2.5 w-2.5 flex-shrink-0" />
                    <span className="truncate">{task.title}</span>
                  </div>
                ))}
                {totalItems > 2 && (
                  <div className="text-[10px] text-muted-foreground">
                    +{totalItems - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Selected day detail */}
      {selectedDay && (
        <div className="mt-4 p-3 border rounded-lg bg-card">
          <h4 className="font-medium mb-2">{format(selectedDay, 'EEEE, MMMM d')}</h4>
          {getItemsForDay(selectedDay).length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments or tasks</p>
          ) : (
            <div className="space-y-2">
              {/* Appointments */}
              {getAppointmentsForDay(selectedDay).map(apt => (
                <div key={apt.id} className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    {getTypeIcon(apt.appointment_type)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{apt.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(apt.start_time), 'h:mm a')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAppointment.mutate(apt.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {/* Tasks */}
              {getTasksForDay(selectedDay).map(task => (
                <div key={task.id} className={cn(
                  "flex items-center gap-2 text-sm",
                  task.is_completed && "opacity-60"
                )}>
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    task.is_completed ? "bg-emerald-500/20 text-emerald-600" : "bg-amber-500/20 text-amber-600"
                  )}>
                    <CheckSquare className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1">
                    <p className={cn("font-medium", task.is_completed && "line-through")}>{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      To Do • {task.status || 'todo'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render Week View
  const renderWeekView = () => (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day => {
          const dayAppointments = getAppointmentsForDay(day);
          const dayTasks = getTasksForDay(day);
          
          return (
            <div key={day.toISOString()} className="space-y-1">
              <div className={cn(
                "text-center py-1 rounded-t-md",
                isToday(day) && "bg-primary text-primary-foreground"
              )}>
                <div className="text-xs font-medium">{format(day, 'EEE')}</div>
                <div className={cn(
                  "text-lg font-bold",
                  !isToday(day) && "text-foreground"
                )}>{format(day, 'd')}</div>
              </div>
              <div className="space-y-1 min-h-[120px]">
                {/* Appointments */}
                {dayAppointments.map(apt => (
                  <div
                    key={apt.id}
                    className="p-2 bg-primary/10 border border-primary/20 rounded text-xs"
                  >
                    <div className="flex items-center gap-1 text-primary">
                      {getTypeIcon(apt.appointment_type)}
                      <span className="font-medium truncate">{apt.title}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {format(parseISO(apt.start_time), 'h:mm a')}
                    </div>
                  </div>
                ))}
                {/* Tasks */}
                {dayTasks.map(task => (
                  <div
                    key={task.id}
                    className={cn(
                      "p-2 rounded text-xs border",
                      task.is_completed 
                        ? "bg-emerald-500/10 border-emerald-500/20" 
                        : "bg-amber-500/10 border-amber-500/20"
                    )}
                  >
                    <div className={cn(
                      "flex items-center gap-1",
                      task.is_completed ? "text-emerald-600" : "text-amber-600"
                    )}>
                      <CheckSquare className="h-3 w-3" />
                      <span className={cn("font-medium truncate", task.is_completed && "line-through")}>{task.title}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">To Do</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render Day View
  const renderDayView = () => {
    const dayAppointments = getAppointmentsForDay(currentDate);
    const dayTasks = getTasksForDay(currentDate);
    const hasItems = dayAppointments.length > 0 || dayTasks.length > 0;
    
    return (
      <div className="space-y-4">
        <div className="text-center py-4 border-b">
          <div className={cn(
            "text-3xl font-bold",
            isToday(currentDate) && "text-primary"
          )}>
            {format(currentDate, 'd')}
          </div>
          <div className="text-lg font-medium text-muted-foreground">
            {format(currentDate, 'EEEE')}
          </div>
          <div className="text-sm text-muted-foreground">
            {format(currentDate, 'MMMM yyyy')}
          </div>
        </div>
        
        {!hasItems ? (
          <div className="text-center text-muted-foreground py-8">
            No appointments or tasks scheduled for this day
          </div>
        ) : (
          <div className="space-y-4">
            {/* Appointments section */}
            {dayAppointments.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Appointments</h4>
                <div className="space-y-2">
                  {dayAppointments.map(apt => (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        {getTypeIcon(apt.appointment_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{apt.title}</p>
                          {apt.google_event_id && (
                            <Badge variant="secondary" className="text-xs h-5 px-1.5">
                              <Check className="h-3 w-3" />
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(apt.start_time), 'h:mm a')}
                          {apt.end_time && ` - ${format(parseISO(apt.end_time), 'h:mm a')}`}
                        </p>
                        {apt.description && (
                          <p className="text-sm text-muted-foreground mt-1">{apt.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteAppointment.mutate(apt.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Tasks section */}
            {dayTasks.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">To Do's</h4>
                <div className="space-y-2">
                  {dayTasks.map(task => (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border transition-colors",
                        task.is_completed 
                          ? "bg-emerald-500/5 border-emerald-500/20 opacity-60" 
                          : "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10"
                      )}
                    >
                      <div className={cn(
                        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                        task.is_completed ? "bg-emerald-500/20 text-emerald-600" : "bg-amber-500/20 text-amber-600"
                      )}>
                        <CheckSquare className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-medium", task.is_completed && "line-through")}>{task.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {task.status === 'done' ? 'Completed' : task.priority ? `${task.priority} priority` : 'To Do'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render Agenda View
  const renderAgendaView = () => (
    <div className="space-y-4">
      {allDatesWithItems.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          No appointments or tasks in this time range
        </div>
      ) : (
        allDatesWithItems.map((dateKey) => {
          const dayAppointments = groupedAppointments[dateKey] || [];
          const dayTasks = groupedTasks[dateKey] || [];
          const firstItem = dayAppointments[0] || dayTasks[0];
          const dateStr = dayAppointments[0]?.start_time || dayTasks[0]?.due_date || dateKey;
          
          return (
            <div key={dateKey}>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                {getDateLabel(dateStr)}
              </h4>
              <div className="space-y-2">
                {/* Appointments */}
                {dayAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      {getTypeIcon(apt.appointment_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{apt.title}</p>
                        {apt.google_event_id && (
                          <Badge variant="secondary" className="text-xs h-5 px-1.5">
                            <Check className="h-3 w-3" />
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(apt.start_time), 'h:mm a')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteAppointment.mutate(apt.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {/* Tasks */}
                {dayTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                      task.is_completed 
                        ? "bg-emerald-500/5 border-emerald-500/20 opacity-60" 
                        : "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10"
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                      task.is_completed ? "bg-emerald-500/20 text-emerald-600" : "bg-amber-500/20 text-amber-600"
                    )}>
                      <CheckSquare className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium truncate", task.is_completed && "line-through")}>
                        {task.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        To Do • {task.priority || 'medium'} priority
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Calendar
          </CardTitle>
          <div className="flex gap-2">
            {/* Google Calendar Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="sm" 
                  variant={calendarStatus?.connected ? "default" : "outline"}
                  disabled={isConnecting}
                  className={calendarStatus?.connected ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : calendarStatus?.connected ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Synced</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Connect</span>
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {calendarStatus?.connected ? (
                  <>
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Connected: {calendarStatus.email}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => syncToGoogle.mutate()}
                      disabled={isSyncing}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${syncToGoogle.isPending ? 'animate-spin' : ''}`} />
                      Push to Google
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => importFromGoogle.mutate()}
                      disabled={isSyncing}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${importFromGoogle.isPending ? 'animate-spin' : ''}`} />
                      Pull from Google
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={disconnectCalendar} className="text-destructive">
                      <Unlink className="h-4 w-4 mr-2" />
                      Disconnect
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={connectCalendar}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Connect Google Calendar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Add Appointment Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Appointment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    placeholder="Appointment title"
                    value={newAppointment.title}
                    onChange={(e) => setNewAppointment(prev => ({ ...prev, title: e.target.value }))}
                  />
                  <Input
                    type="datetime-local"
                    value={newAppointment.start_time}
                    onChange={(e) => setNewAppointment(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">Duration</label>
                      <Select
                        value={newAppointment.duration}
                        onValueChange={(value) => setNewAppointment(prev => ({ ...prev, duration: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="45">45 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="90">1.5 hours</SelectItem>
                          <SelectItem value="120">2 hours</SelectItem>
                          <SelectItem value="180">3 hours</SelectItem>
                          <SelectItem value="240">4 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">Type</label>
                      <Select
                        value={newAppointment.appointment_type}
                        onValueChange={(value) => setNewAppointment(prev => ({ ...prev, appointment_type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="call">Phone Call</SelectItem>
                          <SelectItem value="video">Video Call</SelectItem>
                          <SelectItem value="meeting">In-Person Meeting</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => addAppointment.mutate()}
                    disabled={!newAppointment.title || !newAppointment.start_time}
                  >
                    Add Appointment
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* View Toggle + Navigation */}
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-muted rounded-lg p-0.5">
            <Button
              size="sm"
              variant={viewMode === 'day' ? 'default' : 'ghost'}
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode('day')}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode('week')}
            >
              Week
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode('month')}
            >
              Month
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={navigateToday}>
              Today
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Current Period Label */}
          <div className="text-sm font-medium">
            {viewMode === 'day' 
              ? format(currentDate, 'EEEE, MMMM d, yyyy')
              : viewMode === 'week' 
                ? `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
                : format(currentDate, 'MMMM yyyy')
            }
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden pt-2">
        <div className="flex h-full gap-3">
          {/* Sidebar Filter Panel */}
          <div className={cn(
            "transition-all duration-300 ease-in-out flex-shrink-0 border-r pr-3",
            sidebarOpen ? "w-48" : "w-0 overflow-hidden border-r-0 pr-0"
          )}>
            <div className="space-y-4">
              {/* Toggle Sidebar Button */}
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Calendars
                </h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSidebarOpen(false)}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Calendar Filters */}
              <div className="space-y-2">
                {calendarFilters.map(filter => (
                  <label 
                    key={filter.id}
                    className="flex items-center gap-3 cursor-pointer group py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox 
                      checked={filter.enabled}
                      onCheckedChange={() => toggleFilter(filter.id)}
                      className={cn(
                        "border-2",
                        filter.id === 'appointments' && "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
                        filter.id === 'tasks' && "data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                      )}
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        filter.id === 'appointments' ? "bg-primary" : "bg-amber-500"
                      )} />
                      <span className="text-sm font-medium">{filter.label}</span>
                    </div>
                  </label>
                ))}
              </div>

              {/* Quick Stats */}
              <div className="pt-3 border-t space-y-2">
                <div className="text-xs text-muted-foreground">This period</div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Appointments</span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      {appointments.length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">To-Dos</span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-amber-500/10 text-amber-600">
                      {tasks.length}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsed Sidebar Toggle */}
          {!sidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}

          {/* Main Calendar Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Google Calendar Connection Banner */}
            {!calendarStatus?.connected && !isConnecting && (
              <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <CalendarIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Connect Google Calendar</p>
                      <p className="text-xs text-muted-foreground">Sync your events to see them here</p>
                    </div>
                  </div>
                  <Button 
                    onClick={connectCalendar}
                    size="sm"
                    className="shrink-0"
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Connect
                  </Button>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {viewMode === 'day' && renderDayView()}
                {viewMode === 'week' && renderWeekView()}
                {viewMode === 'month' && renderMonthView()}
                {viewMode === 'agenda' && renderAgendaView()}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
