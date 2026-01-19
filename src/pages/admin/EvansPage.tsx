import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { PerformanceSnapshot } from '@/components/evan/dashboard/PerformanceSnapshot';
import { TodaysPriorities } from '@/components/evan/dashboard/TodaysPriorities';
import { PersonalPipeline } from '@/components/evan/dashboard/PersonalPipeline';
import { ActivityFeed } from '@/components/evan/dashboard/ActivityFeed';
import { CommissionTracker } from '@/components/evan/dashboard/CommissionTracker';
import { Rocket } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type TimePeriod = 'mtd' | 'ytd';

const EvansPage = () => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ytd');

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
        {/* Header with Time Period Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg border bg-card">
              <Rocket className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Command Center</h1>
              <p className="text-sm text-muted-foreground">Sales cockpit</p>
            </div>
          </div>
          
          <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <TabsList>
              <TabsTrigger value="mtd">Month to Date</TabsTrigger>
              <TabsTrigger value="ytd">Year to Date</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Performance Snapshot - Main Focus */}
        <PerformanceSnapshot evanId={evanId} timePeriod={timePeriod} />

        {/* Personal Pipeline - Second Focus, Full Width */}
        <PersonalPipeline evanId={evanId} />

        {/* Today's Priorities */}
        <TodaysPriorities evanId={evanId} />

        {/* Bottom Grid - Commission & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Commission Tracker */}
          <CommissionTracker evanId={evanId} />

          {/* Activity Feed */}
          <ActivityFeed evanId={evanId} />
        </div>
      </div>
    </AdminLayout>
  );
};

export default EvansPage;
