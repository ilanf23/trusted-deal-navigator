import EvanLayout from '@/components/evan/EvanLayout';
import { EvanCalendarWidget } from '@/components/evan/EvanCalendarWidget';

const EvansCalendar = () => {
  return (
    <EvanLayout>
      <div className="space-y-2">
        {/* Clean Apple-style Header */}
        <div className="pb-4">
          <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1">Manage your schedule and appointments</p>
        </div>

        {/* Calendar Widget */}
        <EvanCalendarWidget />
      </div>
    </EvanLayout>
  );
};

export default EvansCalendar;