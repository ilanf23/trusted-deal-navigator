import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { PerformanceSnapshot } from '@/components/evan/dashboard/PerformanceSnapshot';
import { TodaysPriorities } from '@/components/evan/dashboard/TodaysPriorities';
import { PersonalPipeline } from '@/components/evan/dashboard/PersonalPipeline';
import { HotDeals } from '@/components/evan/dashboard/HotDeals';
import { ActivityFeed } from '@/components/evan/dashboard/ActivityFeed';
import { CommissionTracker } from '@/components/evan/dashboard/CommissionTracker';
import { QuickActions } from '@/components/evan/dashboard/QuickActions';
import { Rocket } from 'lucide-react';

const EvansPage = () => {
  // Get Evan's team member ID
  const { data: evanTeamMember } = useQuery({
    queryKey: ['evan-team-member'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id')
        .ilike('name', 'evan')
        .single();
      if (error) throw error;
      return data;
    },
  });

  const evanId = evanTeamMember?.id;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg border bg-card">
            <Rocket className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Command Center</h1>
            <p className="text-sm text-muted-foreground">Sales cockpit</p>
          </div>
        </div>

        {/* Quick Actions - Always visible at top */}
        <QuickActions evanId={evanId} />

        {/* Performance Snapshot */}
        <PerformanceSnapshot evanId={evanId} />

        {/* Today's Priorities */}
        <TodaysPriorities evanId={evanId} />

        {/* Main Grid - Pipeline & Commission */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personal Pipeline - Takes 2 columns */}
          <div className="lg:col-span-2">
            <PersonalPipeline evanId={evanId} />
          </div>

          {/* Commission Tracker */}
          <div>
            <CommissionTracker evanId={evanId} />
          </div>
        </div>

        {/* Bottom Grid - Hot Deals & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hot & At-Risk Deals */}
          <HotDeals evanId={evanId} />

          {/* Activity Feed */}
          <ActivityFeed evanId={evanId} />
        </div>
      </div>
    </AdminLayout>
  );
};

export default EvansPage;
