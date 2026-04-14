import { useState, useRef, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, DatesSetArg, EventContentArg, DateSelectArg } from '@fullcalendar/core';
import { useCalendarData, type ViewMode } from '@/hooks/useCalendarData';
import { CalendarHeader } from './CalendarHeader';
import { CalendarSidebar } from './CalendarSidebar';
import { QuickEventPopover, type QuickEventData } from './QuickEventPopover';
import { EventDialog, type EventDialogData } from './EventDialog';
import { Loader2 } from 'lucide-react';
import './calendar-styles.css';

const VIEW_MAP: Record<ViewMode, string> = {
  day: 'timeGridDay',
  week: 'timeGridWeek',
  month: 'dayGridMonth',
  agenda: 'listWeek',
};

const APPOINTMENT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  call: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  video: { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6' },
  meeting: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  imported: { bg: '#ccfbf1', border: '#14b8a6', text: '#115e59' },
};

const TASK_COLORS = {
  pending: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  completed: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
};

function renderTimeGridEvent(arg: EventContentArg) {
  const { event, timeText } = arg;
  return (
    <div className="fc-custom-event">
      <div className="fc-custom-event-time">{timeText}</div>
      <div className="fc-custom-event-title">{event.title}</div>
    </div>
  );
}

function renderMonthEvent(arg: EventContentArg) {
  const { event, timeText } = arg;
  return (
    <div className="fc-month-event">
      {timeText && <span className="fc-month-event-time">{timeText}</span>}
      <span className="fc-month-event-title">{event.title}</span>
    </div>
  );
}

function renderEventContent(arg: EventContentArg) {
  if (arg.view.type === 'dayGridMonth') return renderMonthEvent(arg);
  if (arg.view.type.startsWith('list')) return undefined;
  return renderTimeGridEvent(arg);
}

export function CalendarView() {
  const calendarRef = useRef<FullCalendar>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [calendarTitle, setCalendarTitle] = useState('');

  const [quickEvent, setQuickEvent] = useState<QuickEventData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<EventDialogData>({
    start: new Date(),
    end: new Date(),
  });

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
    addAppointment,
    updateAppointment,
  } = useCalendarData(viewMode, currentDate);

  const events = useMemo<EventInput[]>(() => {
    const result: EventInput[] = [];

    if (showAppointments) {
      for (const apt of appointments) {
        const colors = APPOINTMENT_COLORS[apt.appointment_type ?? ''] ?? APPOINTMENT_COLORS.call;
        result.push({
          id: `apt-${apt.id}`,
          title: apt.title,
          start: apt.start_time,
          end: apt.end_time ?? undefined,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          textColor: colors.text,
          extendedProps: { type: 'appointment', data: apt },
        });
      }
    }

    if (showTasks) {
      for (const task of tasks) {
        const hasTime = task.due_date.includes('T') && !task.due_date.endsWith('T00:00:00');
        const colors = task.is_completed ? TASK_COLORS.completed : TASK_COLORS.pending;
        result.push({
          id: `task-${task.id}`,
          title: task.title,
          start: task.due_date,
          allDay: !hasTime,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          textColor: colors.text,
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

  const openDialogForCreate = useCallback((start: Date, end: Date, title = '') => {
    setQuickEvent(null);
    setDialogData({ title, start, end });
    setDialogOpen(true);
  }, []);

  const handleCreateEvent = useCallback(() => {
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
    const end = new Date(now.getTime() + 60 * 60000);
    openDialogForCreate(now, end);
  }, [openDialogForCreate]);

  const handleCalendarSelect = useCallback((info: DateSelectArg) => {
    const api = calendarRef.current?.getApi();
    if (api) api.unselect();

    const isAllDay = info.allDay;
    const start = info.start;
    const end = info.end;

    const rect = (info.jsEvent?.target as HTMLElement)?.getBoundingClientRect?.();
    const position = rect
      ? { top: rect.top + rect.height, left: rect.left }
      : { top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 - 150 };

    setQuickEvent({ start, end, allDay: isAllDay, position });
  }, []);

  const handleQuickSave = useCallback(
    (title: string, start: Date, end: Date) => {
      addAppointment.mutate({
        title,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        appointment_type: 'call',
      });
      setQuickEvent(null);
    },
    [addAppointment]
  );

  const handleQuickMoreOptions = useCallback(
    (title: string, start: Date, end: Date) => {
      openDialogForCreate(start, end, title);
    },
    [openDialogForCreate]
  );

  const handleDialogSave = useCallback(
    (event: {
      id?: string;
      title: string;
      start_time: string;
      end_time: string;
      appointment_type: string;
      description?: string;
      lead_id?: string | null;
    }) => {
      if (event.id) {
        updateAppointment.mutate(event as { id: string } & typeof event);
      } else {
        addAppointment.mutate(event);
      }
    },
    [addAppointment, updateAppointment]
  );

  const handleNavLinkDayClick = useCallback((date: Date) => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.changeView('timeGridDay', date);
      setViewMode('day');
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
            allDayText="all-day"
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            slotDuration="00:30:00"
            slotLabelInterval="01:00:00"
            slotLabelFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
            expandRows={true}
            dayMaxEvents={3}
            moreLinkClick="popover"
            navLinks={true}
            navLinkDayClick={handleNavLinkDayClick}
            editable={false}
            selectable={true}
            selectMirror={true}
            unselectAuto={false}
            select={handleCalendarSelect}
            slotEventOverlap={false}
            eventMaxStack={3}
            eventContent={renderEventContent}
            dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
            views={{
              timeGridWeek: {
                dayHeaderFormat: { weekday: 'short', month: 'numeric', day: 'numeric' },
              },
              timeGridDay: {
                dayHeaderFormat: { weekday: 'long', month: 'long', day: 'numeric' },
              },
              dayGridMonth: {
                dayHeaderFormat: { weekday: 'short' },
              },
              listWeek: {
                listDayFormat: { weekday: 'long' },
                listDaySideFormat: { month: 'long', day: 'numeric', year: 'numeric' },
              },
            }}
          />
        </div>
      </div>

      {quickEvent && (
        <QuickEventPopover
          data={quickEvent}
          onSave={handleQuickSave}
          onMoreOptions={handleQuickMoreOptions}
          onClose={() => setQuickEvent(null)}
        />
      )}

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        data={dialogData}
        onSave={handleDialogSave}
      />
    </div>
  );
}

export default CalendarView;
