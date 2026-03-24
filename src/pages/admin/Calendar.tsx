import { useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import EvanLayout from '@/components/evan/EvanLayout';
import { EvanCalendarWidget } from '@/components/evan/EvanCalendarWidget';

const Calendar = () => {
  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Calendar');
    return () => { setPageTitle(null); };
  }, []);

  return (
    <EvanLayout>
      <div className="space-y-2">
        {/* Calendar Widget */}
        <EvanCalendarWidget />
      </div>
    </EvanLayout>
  );
};

export default Calendar;