import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Plus, Phone, Video, Users, Clock, Trash2, RefreshCw, Link2, Unlink, Loader2, Check, ChevronLeft, ChevronRight, List, Grid3X3, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
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

// Fixed callback URL - use the published domain only
const CALENDAR_CALLBACK_URL = 'https://trusted-deal-navigator.lovable.app/admin/calendar-callback';

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

type ViewMode = 'month' | 'week' | 'agenda';
type TimelinePreset = 'today' | 'week' | 'month' | 'custom';

export const EvanCalendarWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [timelinePreset, setTimelinePreset] = useState<TimelinePreset>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [newAppointment, setNewAppointment] = useState({
    title: '',
    start_time: '',
    appointment_type: 'call',
  });
  const [calendarStatus, setCalendarStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const queryClient = useQueryClient();

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
        queryClient.invalidateQueries({ queryKey: ['evan-appointments'] });
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
              queryClient.invalidateQueries({ queryKey: ['evan-appointments'] });
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
              queryClient.invalidateQueries({ queryKey: ['evan-appointments'] });
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

  // Calculate date range based on preset or custom range
  const getDateRange = useCallback(() => {
    const today = startOfDay(new Date());
    
    if (timelinePreset === 'custom' && customDateRange.from && customDateRange.to) {
      return { start: startOfDay(customDateRange.from), end: endOfDay(customDateRange.to) };
    }

    switch (timelinePreset) {
      case 'today':
        return { start: today, end: endOfDay(today) };
      case 'week':
        return { start: today, end: endOfDay(addDays(today, 7)) };
      case 'month':
      default:
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    }
  }, [timelinePreset, currentDate, customDateRange]);

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['evan-appointments', timelinePreset, currentDate.toISOString(), customDateRange.from?.toISOString(), customDateRange.to?.toISOString()],
    queryFn: async () => {
      const { start, end } = getDateRange();
      
      const { data, error } = await supabase
        .from('evan_appointments')
        .select('*')
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data as Appointment[];
    },
  });

  const addAppointment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('evan_appointments')
        .insert({
          title: newAppointment.title,
          start_time: newAppointment.start_time,
          appointment_type: newAppointment.appointment_type,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-appointments'] });
      setNewAppointment({ title: '', start_time: '', appointment_type: 'call' });
      setIsOpen(false);
      toast.success('Appointment added');
    },
    onError: () => toast.error('Failed to add appointment'),
  });

  const deleteAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('evan_appointments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-appointments'] });
      toast.success('Appointment deleted');
    },
  });

  const connectCalendar = async () => {
    setIsConnecting(true);

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
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'getAuthUrl',
          redirectUri: CALENDAR_CALLBACK_URL,
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
      queryClient.invalidateQueries({ queryKey: ['evan-appointments'] });
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
      queryClient.invalidateQueries({ queryKey: ['evan-appointments'] });
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

  // Get appointments for a specific day
  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter(apt => isSameDay(parseISO(apt.start_time), day));
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
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, -7));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 7));
    }
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  const groupedAppointments = appointments.reduce((acc, apt) => {
    const dateKey = format(new Date(apt.start_time), 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(apt);
    return acc;
  }, {} as Record<string, Appointment[]>);

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
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          
          return (
            <div
              key={day.toISOString()}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className={cn(
                "min-h-[60px] p-1 border rounded-md cursor-pointer transition-colors",
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
                {dayAppointments.slice(0, 2).map(apt => (
                  <div
                    key={apt.id}
                    className="text-[10px] bg-primary/20 text-primary rounded px-1 py-0.5 truncate flex items-center gap-1"
                  >
                    {getTypeIcon(apt.appointment_type)}
                    <span className="truncate">{apt.title}</span>
                  </div>
                ))}
                {dayAppointments.length > 2 && (
                  <div className="text-[10px] text-muted-foreground">
                    +{dayAppointments.length - 2} more
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
          {getAppointmentsForDay(selectedDay).length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments</p>
          ) : (
            <div className="space-y-2">
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render Agenda View
  const renderAgendaView = () => (
    <div className="space-y-4">
      {Object.keys(groupedAppointments).length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          No appointments in this time range
        </div>
      ) : (
        Object.entries(groupedAppointments).map(([date, apts]) => (
          <div key={date}>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-background py-1">
              {getDateLabel(apts[0].start_time)}
            </h4>
            <div className="space-y-2">
              {apts.map((apt) => (
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
            </div>
          </div>
        ))
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
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              className="h-7 px-2"
              onClick={() => setViewMode('month')}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              className="h-7 px-2"
              onClick={() => setViewMode('week')}
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'agenda' ? 'default' : 'ghost'}
              className="h-7 px-2"
              onClick={() => setViewMode('agenda')}
            >
              <List className="h-4 w-4" />
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
            {viewMode === 'week' 
              ? `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
              : format(currentDate, 'MMMM yyyy')
            }
          </div>
        </div>

        {/* Timeline Presets + Custom Range */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <div className="flex bg-muted rounded-lg p-0.5">
            {(['today', 'week', 'month'] as TimelinePreset[]).map(preset => (
              <Button
                key={preset}
                size="sm"
                variant={timelinePreset === preset ? 'default' : 'ghost'}
                className="h-6 px-2 text-xs capitalize"
                onClick={() => {
                  setTimelinePreset(preset);
                  if (preset === 'today' || preset === 'week') {
                    setCurrentDate(new Date());
                  }
                }}
              >
                {preset}
              </Button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={timelinePreset === 'custom' ? 'default' : 'outline'}
                className="h-6 text-xs"
              >
                <CalendarIcon className="h-3 w-3 mr-1" />
                {timelinePreset === 'custom' && customDateRange.from && customDateRange.to
                  ? `${format(customDateRange.from, 'MMM d')} - ${format(customDateRange.to, 'MMM d')}`
                  : 'Custom Range'
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: customDateRange.from, to: customDateRange.to }}
                onSelect={(range) => {
                  setCustomDateRange({ from: range?.from, to: range?.to });
                  if (range?.from && range?.to) {
                    setTimelinePreset('custom');
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto pt-2">
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
            {viewMode === 'month' && renderMonthView()}
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'agenda' && renderAgendaView()}
          </>
        )}
      </CardContent>
    </Card>
  );
};
