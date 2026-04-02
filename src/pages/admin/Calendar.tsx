import { useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { CalendarWidget } from '@/components/employee/CalendarWidget';

const Calendar = () => {
  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Calendar');
    return () => { setPageTitle(null); };
  }, []);

  return (
    <EmployeeLayout>
      <div className="space-y-2">
        {/* Calendar Widget */}
        <CalendarWidget />
      </div>
    </EmployeeLayout>
  );
};

export default Calendar;