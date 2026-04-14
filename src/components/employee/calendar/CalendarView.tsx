import { useState, useRef, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, DatesSetArg } from '@fullcalendar/core';
import { useCalendarData, type ViewMode } from '@/hooks/useCalendarData';
import { CalendarHeader } from './CalendarHeader';
import { CalendarSidebar } from './CalendarSidebar';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [calendarTitle, setCalendarTitle] = useState('');

  const {
    appointments,
    tasks,
    isLoading,
    showAppointments,
    showTasks,
    calendarStatus,
    isConnecting,
    isSyncing,
    calendarFilters,
    toggleFilter,
    connectCalendar,
    disconnectCalendar,
    syncToGoogle,
    importFromGoogle,
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
    setCalendarTitle(arg.view.title);
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

  const handleDateSelect = useCallback((date: Date) => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.gotoDate(date);
    }
  }, []);

  const handleCreateEvent = useCallback(() => {
    // Placeholder for Task 5 - will open EventDialog
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
      <CalendarHeader
        title={calendarTitle}
        viewMode={viewMode}
        onToday={handleToday}
        onPrev={handlePrev}
        onNext={handleNext}
        onViewChange={handleViewChange}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />

      <div className="flex flex-1 min-h-0">
        <CalendarSidebar
          open={sidebarOpen}
          currentDate={currentDate}
          onDateSelect={handleDateSelect}
          onCreateEvent={handleCreateEvent}
          filters={calendarFilters}
          onToggleFilter={toggleFilter}
          calendarStatus={calendarStatus}
          isConnecting={isConnecting}
          isSyncing={isSyncing}
          onConnect={connectCalendar}
          onDisconnect={disconnectCalendar}
          onSyncToGoogle={() => syncToGoogle.mutate()}
          onImportFromGoogle={() => importFromGoogle.mutate()}
        />

        <div className="flex-1 min-w-0 p-2">
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
    </div>
  );
}

export default CalendarView;
