import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WendyMetrics {
  activeDeals: number;
  avgDaysPerDeal: number;
  closingsLast30d: number;
  conversionRate: number;
  callsToday: number;
  emailsSent: number;
}

export interface WendyFollowUp {
  client: string;
  lastContact: string;
  nextAction: string;
  priority: string;
  dealStage: string;
}

export interface WendyCommunication {
  type: string;
  client: string;
  summary: string;
  duration: string;
  time: string;
}

export interface WendyDailyTarget {
  label: string;
  current: number;
  target: number;
  progress: number;
}

const derivePriority = (daysInStage: number): string => {
  if (daysInStage > 10) return 'High';
  if (daysInStage > 5) return 'Medium';
  return 'Low';
};

const deriveLastContact = (daysInStage: number): string => {
  if (daysInStage === 0) return 'Today';
  if (daysInStage === 1) return '1 day ago';
  if (daysInStage < 7) return `${daysInStage} days ago`;
  if (daysInStage < 14) return '1 week ago';
  return `${Math.floor(daysInStage / 7)} weeks ago`;
};

const deriveNextAction = (stage: string): string => {
  const lower = (stage || '').toLowerCase();
  if (lower.includes('initial') || lower.includes('discovery')) return 'Schedule intro call';
  if (lower.includes('document') || lower.includes('collection')) return 'Follow up on bank statements';
  if (lower.includes('underwriting') || lower.includes('review')) return 'Request updated financials';
  if (lower.includes('lender') || lower.includes('negotiation')) return 'Send term sheet';
  if (lower.includes('close') || lower.includes('path')) return 'Schedule closing call';
  return 'Follow up with client';
};

export const useWendysDashboard = () => {
  const perfQuery = useQuery({
    queryKey: ['wendy-team-performance'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_team_performance')
        .select('*')
        .ilike('name', 'Wendy')
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const dealsQuery = useQuery({
    queryKey: ['wendy-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_deals')
        .select('*')
        .ilike('owner_name', 'Wendy')
        .order('days_in_stage', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const goalsQuery = useQuery({
    queryKey: ['wendy-monthly-goals'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('team_monthly_goals')
        .select('*')
        .ilike('team_member_name', 'Wendy');
      if (error) throw error;
      return data ?? [];
    },
  });

  const perf = perfQuery.data;
  const deals = dealsQuery.data ?? [];

  const closedStages = ['closed', 'funded', 'complete'];
  const activeDeals = deals.filter(
    (d: any) => !closedStages.some(s => (d.stage || '').toLowerCase().includes(s))
  );
  const midLateStages = ['underwriting', 'lender', 'negotiation', 'close', 'path'];
  const emailsSent = activeDeals.filter(
    (d: any) => midLateStages.some(s => (d.stage || '').toLowerCase().includes(s))
  ).length;

  const metrics: WendyMetrics = {
    activeDeals: perf?.active_deals ?? 0,
    avgDaysPerDeal: perf?.avg_days ?? 0,
    closingsLast30d: perf?.closings ?? 0,
    conversionRate: perf?.conversion ?? 0,
    callsToday: activeDeals.length,
    emailsSent,
  };

  const clientFollowUps: WendyFollowUp[] = activeDeals.map((d: any) => ({
    client: d.deal_name || 'Unknown',
    lastContact: deriveLastContact(d.days_in_stage || 0),
    nextAction: deriveNextAction(d.stage),
    priority: derivePriority(d.days_in_stage || 0),
    dealStage: d.stage || 'Unknown',
  }));

  const communicationLog: WendyCommunication[] = [];

  const dailyTargets: WendyDailyTarget[] = (goalsQuery.data ?? []).map((g: any) => {
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
    clientFollowUps,
    communicationLog,
    dailyTargets,
    isLoading,
  };
};
