import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Plus, Phone, Video, Users, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isTomorrow, addDays, startOfDay, endOfDay } from 'date-fns';
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

interface Appointment {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  lead_id: string | null;
  appointment_type: string | null;
}

export const EvanCalendarWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    title: '',
    start_time: '',
    appointment_type: 'call',
  });
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['evan-appointments'],
    queryFn: async () => {
      const today = startOfDay(new Date());
      const weekEnd = endOfDay(addDays(today, 7));
      
      const { data, error } = await supabase
        .from('evan_appointments')
        .select('*')
        .gte('start_time', today.toISOString())
        .lte('start_time', weekEnd.toISOString())
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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Appointments
          </CardTitle>
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
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-4">Loading...</div>
        ) : Object.keys(groupedAppointments).length === 0 ? (
          <div className="text-center text-muted-foreground py-4">No upcoming appointments</div>
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
                        <p className="text-sm font-medium truncate">{apt.title}</p>
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
