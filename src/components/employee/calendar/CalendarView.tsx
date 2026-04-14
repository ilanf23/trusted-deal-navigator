import { useState, useRef, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, DatesSetArg } from '@fullcalendar/core';
import { useCalendarData, type ViewMode } from '@/hooks/useCalendarData';
import { Loader2 } from 'lucide-react';
import './calendar-styles.css';

const VIEW_MAP: Record<ViewMode, string> = {
  day: 'timeGridDay',
  week: 'timeGridWeek',
  month: 'dayGridMonth',
  agenda: 'listWeek',
};

export function CalendarView() {
  const calendarRef = useRef<FullCalendar>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const {
    appointments,
    tasks,
    isLoading,
    showAppointments,
    showTasks,
  } = useCalendarData(viewMode, currentDate);

  const events = useMemo<EventInput[]>(() => {
    const result: EventInput[] = [];

    if (showAppointments) {
      for (const apt of appointments) {
        const colorMap: Record<string, string> = {
          call: '#3b82f6',
          video: '#8b5cf6',
          meeting: '#22c55e',
          imported: '#14b8a6',
        };
        result.push({
          id: `apt-${apt.id}`,
          title: apt.title,
          start: apt.start_time,
          end: apt.end_time ?? undefined,
          backgroundColor: colorMap[apt.appointment_type ?? ''] ?? '#3b82f6',
          borderColor: colorMap[apt.appointment_type ?? ''] ?? '#3b82f6',
          extendedProps: { type: 'appointment', data: apt },
        });
      }
    }

    if (showTasks) {
      for (const task of tasks) {
        const hasTime = task.due_date.includes('T') && !task.due_date.endsWith('T00:00:00');
        result.push({
          id: `task-${task.id}`,
          title: task.title,
          start: task.due_date,
          allDay: !hasTime,
          backgroundColor: task.is_completed ? '#10b981' : '#f59e0b',
          borderColor: task.is_completed ? '#10b981' : '#f59e0b',
          extendedProps: { type: 'task', data: task },
        });
      }
    }

    return result;
  }, [appointments, tasks, showAppointments, showTasks]);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setCurrentDate(arg.view.currentStart);
  }, []);

  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    const api = calendarRef.current?.getApi();
    if (api) {
      api.changeView(VIEW_MAP[mode]);
    }
  }, []);

  const handleToday = useCallback(() => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.today();
    }
  }, []);

  const handlePrev = useCallback(() => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.prev();
    }
  }, []);

  const handleNext = useCallback(() => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.next();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 px-2">
        <button
          onClick={handleToday}
          className="px-3 py-1.5 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
        >
          Today
        </button>
        <button onClick={handlePrev} className="p-1.5 hover:bg-accent rounded-md transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button onClick={handleNext} className="p-1.5 hover:bg-accent rounded-md transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold flex-1">
          {calendarRef.current?.getApi()?.view.title ?? ''}
        </h2>
        <div className="flex border rounded-md overflow-hidden">
          {(['day', 'week', 'month', 'agenda'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => handleViewChange(mode)}
              className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                viewMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              {mode === 'agenda' ? 'Schedule' : mode}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={VIEW_MAP[viewMode]}
          initialDate={currentDate}
          headerToolbar={false}
          events={events}
          datesSet={handleDatesSet}
          nowIndicator={true}
          height="100%"
          scrollTime="08:00:00"
          allDaySlot={true}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration="00:30:00"
          expandRows={true}
          dayMaxEvents={3}
          navLinks={true}
          editable={false}
          selectable={false}
        />
      </div>
    </div>
  );
}

export default CalendarView;
