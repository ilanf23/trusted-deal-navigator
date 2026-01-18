import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Phone, Video, Users, Clock, Trash2, RefreshCw, Link2, Unlink, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isTomorrow, addDays, addMonths, startOfDay, endOfDay } from 'date-fns';
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
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

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

type TimelineFilter = 'today' | 'week' | 'month';

export const EvanCalendarWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('week');
  const [newAppointment, setNewAppointment] = useState({
    title: '',
    start_time: '',
    appointment_type: 'call',
  });
  const [calendarStatus, setCalendarStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
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

  // Listen for popup OAuth completion
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

    window.addEventListener('message', handleMessage);
    checkCalendarStatus();

    return () => window.removeEventListener('message', handleMessage);
  }, [checkCalendarStatus, queryClient]);

  // Calculate date range based on filter
  const getDateRange = () => {
    const today = startOfDay(new Date());
    switch (timelineFilter) {
      case 'today':
        return { start: today, end: endOfDay(today) };
      case 'week':
        return { start: today, end: endOfDay(addDays(today, 7)) };
      case 'month':
        return { start: today, end: endOfDay(addMonths(today, 1)) };
      default:
        return { start: today, end: endOfDay(addDays(today, 7)) };
    }
  };

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['evan-appointments', timelineFilter],
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

    // Open the popup immediately (must be synchronous to avoid popup blockers)
    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      'about:blank',
      'google-calendar-auth',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );

    if (!popup || popup.closed) {
      toast.error('Popup blocked. Please allow popups for this site.');
      setIsConnecting(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'getAuthUrl',
          redirectUri: CALENDAR_CALLBACK_URL,
        },
      });

      if (error) throw error;
      if (!data?.authUrl) throw new Error('Missing authUrl');

      // Navigate the already-open popup to Google
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
      case 'call': return <Phone className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'meeting': return <Users className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMM d');
  };

  const groupedAppointments = appointments.reduce((acc, apt) => {
    const dateKey = format(new Date(apt.start_time), 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(apt);
    return acc;
  }, {} as Record<string, Appointment[]>);

  const isSyncing = syncToGoogle.isPending || importFromGoogle.isPending;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Appointments
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
                      <span className="hidden sm:inline">Calendar</span>
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
                  <Plus className="h-4 w-4 mr-1" /> Add
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

        {/* Timeline Filter Tabs */}
        <Tabs value={timelineFilter} onValueChange={(v) => setTimelineFilter(v as TimelineFilter)} className="mt-3">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
            <TabsTrigger value="week" className="text-xs">This Week</TabsTrigger>
            <TabsTrigger value="month" className="text-xs">This Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Loading...</div>
        ) : Object.keys(groupedAppointments).length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No appointments {timelineFilter === 'today' ? 'today' : timelineFilter === 'week' ? 'this week' : 'this month'}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedAppointments).map(([date, apts]) => (
              <div key={date}>
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
