import { useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { CalendarView } from '@/components/employee/calendar/CalendarView';

const Calendar = () => {
  const { setPageTitle } = useAdminTopBar();
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