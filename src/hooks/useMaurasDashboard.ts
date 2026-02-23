import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MauraMetrics {
  activeDeals: number;
  avgDaysPerDeal: number;
  closingsLast30d: number;
  conversionRate: number;
  docsProcessedToday: number;
  pendingReview: number;
}

export interface MauraProcessingItem {
  client: string;
  type: string;
  status: string;
  priority: string;
  daysInQueue: number;
}

export interface MauraActivity {
  action: string;
  client: string;
  document: string;
  time: string;
}

export interface MauraDailyProgress {
  label: string;
  current: number;
  target: number;
  progress: number;
}

const deriveStatus = (stage: string): string => {
  const lower = (stage || '').toLowerCase();
  if (lower.includes('closed') || lower.includes('funded') || lower.includes('complete')) return 'Complete';
  if (lower.includes('underwriting') || lower.includes('review') || lower.includes('negotiation')) return 'In Review';
  return 'Pending';
};

const derivePriority = (daysInStage: number): string => {
  if (daysInStage > 10) return 'High';
  if (daysInStage > 5) return 'Medium';
  return 'Low';
};

export const useMaurasDashboard = () => {
  // Team performance from view
  const perfQuery = useQuery({
    queryKey: ['maura-team-performance'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_team_performance')
        .select('*')
        .ilike('name', 'Maura')
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  // Deals for Maura
  const dealsQuery = useQuery({
    queryKey: ['maura-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_deals')
        .select('*')
        .ilike('owner_name', 'Maura')
        .order('days_in_stage', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Daily progress goals
  const goalsQuery = useQuery({
    queryKey: ['maura-monthly-goals'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('team_monthly_goals')
        .select('*')
        .ilike('team_member_name', 'Maura');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Derive metrics
  const perf = perfQuery.data;
  const deals = dealsQuery.data ?? [];

  const closedStages = ['closed', 'funded', 'complete'];
  const activeDeals = deals.filter(
    (d: any) => !closedStages.some(s => (d.stage || '').toLowerCase().includes(s))
  );
  const earlyStages = ['discovery', 'initial', 'pending', 'new'];
  const pendingReview = activeDeals.filter(
    (d: any) => earlyStages.some(s => (d.stage || '').toLowerCase().includes(s))
  ).length;

  const metrics: MauraMetrics = {
    activeDeals: perf?.active_deals ?? 0,
    avgDaysPerDeal: perf?.avg_days ?? 0,
    closingsLast30d: perf?.closings ?? 0,
    conversionRate: perf?.conversion ?? 0,
    docsProcessedToday: activeDeals.length,
    pendingReview,
  };

  const processingQueue: MauraProcessingItem[] = activeDeals.map((d: any) => ({
    client: d.deal_name || 'Unknown',
    type: d.stage || 'General',
    status: deriveStatus(d.stage),
    priority: derivePriority(d.days_in_stage || 0),
    daysInQueue: d.days_in_stage || 0,
  }));

  // No activity log table exists — return empty array
  const recentActivity: MauraActivity[] = [];

  const dailyProgress: MauraDailyProgress[] = (goalsQuery.data ?? []).map((g: any) => {
    const current = g.current_value;
    const target = g.target_value;
    const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return {
      label: g.goal_label,
      current,
      target,
      progress,
    };
  });

  const isLoading =
    perfQuery.isLoading ||
    dealsQuery.isLoading ||
    goalsQuery.isLoading;

  return {
    metrics,
    processingQueue,
    recentActivity,
    dailyProgress,
    isLoading,
  };
};
