import AdminLayout from '@/components/admin/AdminLayout';
import { EvanTasksWidget } from '@/components/evan/EvanTasksWidget';
import { EvanCalendarWidget } from '@/components/evan/EvanCalendarWidget';
import { EvanNotesWidget } from '@/components/evan/EvanNotesWidget';
import { EvanCommunicationsWidget } from '@/components/evan/EvanCommunicationsWidget';
import { EvanLeadsWidget } from '@/components/evan/EvanLeadsWidget';
import { EvanMetricsWidget } from '@/components/evan/EvanMetricsWidget';

const EvansPage = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Evan's Dashboard</h1>
          <p className="text-muted-foreground">Your personal workspace for managing leads and communications</p>
        </div>

        {/* Performance Metrics - Full Width */}
        <EvanMetricsWidget />

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Communications & Leads */}
          <div className="lg:col-span-2 space-y-6">
            {/* Communications Widget */}
            <div className="h-[400px]">
              <EvanCommunicationsWidget />
            </div>

            {/* Leads Widget */}
            <div className="h-[500px]">
              <EvanLeadsWidget />
            </div>
          </div>

          {/* Right Column - Tasks, Calendar, Notes */}
          <div className="space-y-6">
            {/* Tasks Widget */}
            <div className="h-[350px]">
              <EvanTasksWidget />
            </div>

            {/* Calendar Widget */}
            <div className="h-[350px]">
              <EvanCalendarWidget />
            </div>

            {/* Quick Notes Widget */}
            <div className="h-[300px]">
              <EvanNotesWidget />
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default EvansPage;
