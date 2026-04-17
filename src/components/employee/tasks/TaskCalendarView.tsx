import { Task, statusConfig } from './types';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, startOfWeek, endOfWeek, addMonths, subMonths, isToday } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMember } from '@/hooks/useTeamMember';

interface Appointment {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  appointment_type: string | null;
  google_event_id: string | null;
}

interface TaskCalendarViewProps {
  tasks: Task[];
  onOpenDetail: (task: Task) => void;
  onAddTask: (task: Partial<Task>) => void;
}

export const TaskCalendarView = ({
  tasks,
  onOpenDetail,
  onAddTask,
}: TaskCalendarViewProps) => {
  const { teamMember } = useTeamMember();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Fetch Google Calendar appointments - filtered to current user's calendar
  const { data: appointments = [] } = useQuery({
    queryKey: ['appointments-calendar', teamMember?.id, currentMonth.toISOString()],
    queryFn: async () => {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from('appointments')
        .select('id, title, start_time, end_time, appointment_type, google_event_id')
        .eq('user_id', teamMember!.id)
        .gte('start_time', monthStart.toISOString())
        .lte('start_time', monthEnd.toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!teamMember?.id,
  });
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getTasksForDay = (date: Date) => 
    tasks.filter(task => task.due_date && isSameDay(parseISO(task.due_date), date));

  const getAppointmentsForDay = (date: Date) =>
    appointments.filter(apt => isSameDay(parseISO(apt.start_time), date));

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="rounded-2xl border border-muted-foreground/10 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-muted-foreground/10">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={prevMonth}
          className="h-9 w-9 rounded-full hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold text-lg tracking-tight">{format(currentMonth, 'MMMM yyyy')}</h2>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={nextMonth}
          className="h-9 w-9 rounded-full hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 border-b border-muted-foreground/10">
        {weekDays.map(day => (
          <div key={day} className="py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayTasks = getTasksForDay(day);
          const dayAppointments = getAppointmentsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);
          const totalItems = dayTasks.length + dayAppointments.length;
          
          return (
            <div
              key={idx}
              className={`min-h-[160px] p-3 border-b border-r border-muted-foreground/5 transition-colors hover:bg-muted/30 cursor-pointer ${
                !isCurrentMonth ? 'bg-muted/20' : ''
              }`}
              onClick={() => onAddTask({ due_date: day.toISOString() })}
            >
              <div className={`flex items-center justify-center w-8 h-8 rounded-full mb-2 text-sm font-semibold ${
                isTodayDate 
                  ? 'bg-foreground text-background' 
                  : !isCurrentMonth 
                    ? 'text-muted-foreground/50' 
                    : ''
              }`}>
                {format(day, 'd')}
              </div>
              
              <div className="space-y-1.5">
                {/* Google Calendar Appointments (blue with calendar icon) */}
                {dayAppointments.slice(0, 3).map(apt => (
                  <div
                    key={`apt-${apt.id}`}
                    className="text-sm py-2 px-3 rounded-lg truncate flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-l-3 border-blue-500 shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate font-medium">{apt.title}</span>
                    <span className="text-xs opacity-70 flex-shrink-0">
                      {format(parseISO(apt.start_time), 'h:mm a')}
                    </span>
                  </div>
                ))}
                
                {/* Tasks */}
                {dayTasks.slice(0, dayAppointments.length >= 3 ? 1 : 3).map(task => (
                  <div
                    key={task.id}
                    className="text-sm py-2 px-3 rounded-lg truncate cursor-pointer transition-all hover:scale-[1.02] shadow-sm font-medium"
                    style={{ 
                      backgroundColor: `${statusConfig[task.status || 'todo']?.color}20`,
                      color: statusConfig[task.status || 'todo']?.color,
                      borderLeft: `3px solid ${statusConfig[task.status || 'todo']?.color}`
                    }}
                    onClick={(e) => { e.stopPropagation(); onOpenDetail(task); }}
                  >
                    {task.title}
                  </div>
                ))}
                
                {totalItems > 4 && (
                  <div className="text-sm text-muted-foreground px-3 font-medium">
                    +{totalItems - 4} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
