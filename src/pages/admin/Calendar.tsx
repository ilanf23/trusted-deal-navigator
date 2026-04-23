import { useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { usePageDatabases } from '@/hooks/usePageDatabases';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { CalendarView } from '@/components/employee/calendar/CalendarView';

const Calendar = () => {
  const { setPageTitle } = useAdminTopBar();
  usePageDatabases([
    { table: 'appointments', access: 'readwrite', usage: 'Calendar events — list, create, update, delete.', via: 'src/hooks/useCalendarData.ts via CalendarView' },
    { table: 'calendar_connections', access: 'read', usage: 'Connected Google Calendar accounts used for sync.', via: 'src/hooks/useCalendarData.ts' },
    { table: 'google-calendar-sync', access: 'rpc', usage: 'Edge function pulling latest events from Google Calendar.', via: 'supabase.functions.invoke("google-calendar-sync")' },
    { table: 'google-calendar-auth', access: 'rpc', usage: 'Edge function handling OAuth for the calendar connection.', via: 'supabase.functions.invoke("google-calendar-auth")' },
  ]);
  useEffect(() => {
    setPageTitle('Calendar');
    return () => { setPageTitle(null); };
  }, [setPageTitle]);

  return (
    <EmployeeLayout>
      <div className="h-[calc(100vh-8rem)]">
        <CalendarView />
      </div>
    </EmployeeLayout>
  );
};

export default Calendar;