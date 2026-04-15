import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  getDealRevenue,
  type ActivityDay,
  type SparklineDataSet,
  type PeriodComparison,
  type PeriodOverPeriod,
} from '@/components/admin/dashboard/useDashboardData';

export type TimePeriod = 'ytd' | 'mtd';

export interface RevenueTarget {
  period_type: string;
  target_amount: number;
  current_amount: number;
  forecast_amount: number;
  forecast_confidence: number;
  pace_vs_plan: number;
}

export interface PipelineStage {
  stage: string;
  deal_count: number;
  total_requested: number;
  total_weighted_fees: number;
  median_days: number;
}

export interface TeamPerformance {
  name: string;
  active_deals: number;
  avg_days: number;
  closings: number;
  conversion: number;
}

export interface ReferralSource {
  name: string;
  total_revenue: number;
  status: string;
  last_contact_days_ago: number;
}

export interface ScorecardItem {
  metric_label: string;
  metric_value: string;
  display_order: number;
  color_class: string | null;
}

interface TeamMemberRecord {
  id: string;
  name: string;
  position: string | null;
  app_role: string | null;
  is_owner: boolean | null;
  is_active: boolean;
}

export interface RevenueByTeamMember {
  name: string;
  revenue: number;
  dealCount: number;
}

function makePeriodComparison(current: number, previous: number): PeriodComparison {
  const delta = current - previous;
  const deltaPercent = previous > 0
    ? ((current - previous) / previous) * 100
    : current > 0 ? 100 : 0;
  return { current, previous, delta, deltaPercent };
}

function getPeriodStartUTC(period: TimePeriod): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (period === 'mtd') return new Date(Date.UTC(y, m, 1)).toISOString();
  return new Date(Date.UTC(y, 0, 1)).toISOString();
}

function getPreviousPeriodRange(period: TimePeriod): { start: string; end: string } {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  if (period === 'mtd') {
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m - 1, day, 23, 59, 59));
    return { start: start.toISOString(), end: end.toISOString() };
  }
  const start = new Date(Date.UTC(y - 1, 0, 1));
  const end = new Date(Date.UTC(y - 1, m, day, 23, 59, 59));
  return { start: start.toISOString(), end: end.toISOString() };
}

export const getTeamMemberUrl = (name: string, teamMembers?: TeamMemberRecord[]) => {
  if (teamMembers) {
    const member = teamMembers.find(
      m => m.name.toLowerCase() === name.toLowerCase(),
    );
    if (member) {
      const slug = member.name.toLowerCase();
      if (member.is_owner || member.app_role === 'super_admin') {
        return `/superadmin/${slug}`;
      }
      return `/admin/${slug}`;
    }
  }
  return `/admin/${name.toLowerCase()}`;
};

export const getTeamMemberRole = (name: string, teamMembers?: TeamMemberRecord[]) => {
  if (teamMembers) {
    const member = teamMembers.find(
      m => m.name.toLowerCase() === name.toLowerCase(),
    );
    if (member?.position) return member.position;
  }
  return 'Team Member';
};

export const useSuperAdminDashboard = (timePeriod: TimePeriod) => {
  const now = new Date();
  const periodStartISO = getPeriodStartUTC(timePeriod);
  const prevRange = getPreviousPeriodRange(timePeriod);

  // Revenue targets
  const revenueQuery = useQuery({
    queryKey: ['dashboard-revenue-targets'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('revenue_targets')
        .select('*');
      if (error) throw error;
      return data as RevenueTarget[];
    },
  });

  // Pipeline metrics (from view)
  const pipelineQuery = useQuery({
    queryKey: ['dashboard-pipeline-metrics'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_pipeline_metrics')
        .select('*');
      if (error) throw error;
      return data as PipelineStage[];
    },
  });

  // Team performance (from view)
  const teamQuery = useQuery({
    queryKey: ['dashboard-team-performance'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_team_performance')
        .select('*');
      if (error) throw error;
      return data as TeamPerformance[];
    },
  });

  // Referral analytics (from view)
  const referralQuery = useQuery({
    queryKey: ['dashboard-referral-analytics'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_referral_analytics')
        .select('*');
      if (error) throw error;
      return data as ReferralSource[];
    },
  });

  // Weekly scorecard
  const scorecardQuery = useQuery({
    queryKey: ['dashboard-weekly-scorecard'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dashboard_weekly_scorecard')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data as ScorecardItem[];
    },
  });

  // Team members from users table (replaces hardcoded maps)
  const usersQuery = useQuery({
    queryKey: ['dashboard-team-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, position, app_role, is_owner, is_active')
        .eq('is_active', true)
        .in('app_role', ['admin', 'super_admin']);
      if (error) throw error;
      return data as TeamMemberRecord[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Company-wide daily activity data (for heatmap) — last 90 days
  const heatmapRangeStart = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 89,
  )).toISOString();

  const heatmapDealsQuery = useQuery({
    queryKey: ['sa-dashboard-heatmap-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id, created_at, stage_changed_at, won_at')
        .or(`created_at.gte.${heatmapRangeStart},stage_changed_at.gte.${heatmapRangeStart},won_at.gte.${heatmapRangeStart}`);
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const heatmapCommsQuery = useQuery({
    queryKey: ['sa-dashboard-heatmap-comms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('id, created_at')
        .gte('created_at', heatmapRangeStart);
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  // Sparkline data — last 12 months of won/lost deals
  const sparklineStart = new Date(Date.UTC(
    now.getUTCFullYear() - 1, now.getUTCMonth(), 1,
  )).toISOString();

  const sparklineQuery = useQuery({
    queryKey: ['sa-dashboard-sparkline-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id, won_at, lost_at, deal_value, potential_revenue, fee_percent, deal_outcome')
        .or(`won_at.gte.${sparklineStart},lost_at.gte.${sparklineStart}`)
        .in('deal_outcome', ['won', 'lost']);
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  // Revenue by team member — won deals in current period with assigned_to
  const revenueByTeamQuery = useQuery({
    queryKey: ['sa-dashboard-revenue-by-team', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id, assigned_to, deal_value, potential_revenue, fee_percent, won_at')
        .eq('deal_outcome', 'won')
        .gte('won_at', periodStartISO);
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });

  // Previous period won deals (for period-over-period)
  const prevWonQuery = useQuery({
    queryKey: ['sa-dashboard-prev-won', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id, deal_value, potential_revenue, fee_percent')
        .eq('deal_outcome', 'won')
        .gte('won_at', prevRange.start)
        .lte('won_at', prevRange.end);
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });

  // Current period lost deals
  const currentLostQuery = useQuery({
    queryKey: ['sa-dashboard-current-lost', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id')
        .eq('deal_outcome', 'lost')
        .gte('lost_at', periodStartISO);
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });

  // Previous period lost deals
  const prevLostQuery = useQuery({
    queryKey: ['sa-dashboard-prev-lost', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id')
        .eq('deal_outcome', 'lost')
        .gte('lost_at', prevRange.start)
        .lte('lost_at', prevRange.end);
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });

  // Open pipeline deals (for pipeline value delta)
  const pipelineDealsQuery = useQuery({
    queryKey: ['sa-dashboard-pipeline-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id, deal_value, potential_revenue, fee_percent, status')
        .eq('deal_outcome', 'open');
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_deals' }, () => {
        pipelineQuery.refetch();
        teamQuery.refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revenue_targets' }, () => {
        revenueQuery.refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_referral_sources' }, () => {
        referralQuery.refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard_weekly_scorecard' }, () => {
        scorecardQuery.refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Current metrics based on time period
  const currentMetrics = revenueQuery.data?.find(r => r.period_type === timePeriod) ?? null;

  // Annual target for sparkline goal progress
  const annualTarget = useMemo(() => {
    const annual = revenueQuery.data?.find(r => r.period_type === 'annual' || r.period_type === 'ytd');
    return annual?.target_amount ?? 1500000;
  }, [revenueQuery.data]);

  // Activity heatmap data (company-wide, last 90 days)
  const activityHeatmapData: ActivityDay[] = useMemo(() => {
    const deals = heatmapDealsQuery.data || [];
    const comms = heatmapCommsQuery.data || [];

    const dayMap = new Map<string, { dealsCreated: number; stageChanges: number; communications: number }>();

    function addToDay(dateStr: string | null, field: 'dealsCreated' | 'stageChanges' | 'communications') {
      if (!dateStr) return;
      const day = dateStr.slice(0, 10);
      const entry = dayMap.get(day) || { dealsCreated: 0, stageChanges: 0, communications: 0 };
      entry[field] += 1;
      dayMap.set(day, entry);
    }

    for (const deal of deals) {
      addToDay(deal.created_at, 'dealsCreated');
      addToDay(deal.stage_changed_at, 'stageChanges');
      addToDay(deal.won_at, 'stageChanges');
    }
    for (const comm of comms) {
      addToDay(comm.created_at, 'communications');
    }

    return Array.from(dayMap.entries()).map(([date, breakdown]) => ({
      date,
      total: breakdown.dealsCreated + breakdown.stageChanges + breakdown.communications,
      breakdown,
    }));
  }, [heatmapDealsQuery.data, heatmapCommsQuery.data]);

  // Sparkline data (last 12 months per metric)
  const sparklineData: SparklineDataSet = useMemo(() => {
    const deals = sparklineQuery.data || [];
    const months: { start: Date; end: Date }[] = [];
    const monthlyGoal = annualTarget / 12;

    for (let i = 11; i >= 0; i--) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0, 23, 59, 59));
      months.push({ start, end });
    }

    const revenue: number[] = [];
    const dealCounts: number[] = [];
    const winRates: number[] = [];
    const goalProgressArr: number[] = [];

    for (const { start, end } of months) {
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      const wonInMonth = deals.filter(d =>
        d.deal_outcome === 'won' && d.won_at && d.won_at >= startISO && d.won_at <= endISO,
      );
      const lostInMonth = deals.filter(d =>
        d.deal_outcome === 'lost' && d.lost_at && d.lost_at >= startISO && d.lost_at <= endISO,
      );

      const monthRevenue = wonInMonth.reduce((sum, d) => sum + getDealRevenue(d), 0);
      revenue.push(monthRevenue);
      dealCounts.push(wonInMonth.length);

      const totalDecisions = wonInMonth.length + lostInMonth.length;
      winRates.push(totalDecisions > 0 ? (wonInMonth.length / totalDecisions) * 100 : 0);
      goalProgressArr.push(monthlyGoal > 0 ? (monthRevenue / monthlyGoal) * 100 : 0);
    }

    const currentPipelineValue = (pipelineDealsQuery.data || []).reduce(
      (sum, d) => sum + getDealRevenue(d), 0,
    );
    const pipeline = new Array(12).fill(currentPipelineValue);

    return { revenue, deals: dealCounts, pipeline, winRate: winRates, goalProgress: goalProgressArr };
  }, [sparklineQuery.data, pipelineDealsQuery.data, annualTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // Revenue by team member (for comparison chart)
  const revenueByTeamMember: RevenueByTeamMember[] = useMemo(() => {
    const wonDeals = revenueByTeamQuery.data || [];
    const users = usersQuery.data || [];

    const memberMap = new Map<string, { revenue: number; count: number }>();
    for (const deal of wonDeals) {
      const assignedId = deal.assigned_to;
      if (!assignedId) continue;
      const entry = memberMap.get(assignedId) || { revenue: 0, count: 0 };
      entry.revenue += getDealRevenue(deal);
      entry.count += 1;
      memberMap.set(assignedId, entry);
    }

    return Array.from(memberMap.entries())
      .map(([userId, data]) => {
        const user = users.find(u => u.id === userId);
        return {
          name: user?.name || 'Unknown',
          revenue: data.revenue,
          dealCount: data.count,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [revenueByTeamQuery.data, usersQuery.data]);

  // Period-over-period delta calculations for all KPI metrics
  const periodOverPeriod: PeriodOverPeriod = useMemo(() => {
    const currentWon = revenueByTeamQuery.data || [];
    const previousWon = prevWonQuery.data || [];
    const currentLost = currentLostQuery.data || [];
    const previousLost = prevLostQuery.data || [];

    const currentRevenue = currentWon.reduce((sum, d) => sum + getDealRevenue(d), 0);
    const previousRevenue = previousWon.reduce((sum, d) => sum + getDealRevenue(d), 0);

    const currentWonCount = currentWon.length;
    const prevWonCount = previousWon.length;

    const currentDecisions = currentWonCount + currentLost.length;
    const currentWinRate = currentDecisions > 0 ? (currentWonCount / currentDecisions) * 100 : 0;
    const prevDecisions = prevWonCount + previousLost.length;
    const prevWinRate = prevDecisions > 0 ? (prevWonCount / prevDecisions) * 100 : 0;

    const pipelineValue = (pipelineDealsQuery.data || []).reduce(
      (sum, d) => sum + getDealRevenue(d), 0,
    );

    return {
      revenue: makePeriodComparison(currentRevenue, previousRevenue),
      deals: makePeriodComparison(currentWonCount, prevWonCount),
      winRate: makePeriodComparison(currentWinRate, prevWinRate),
      pipelineValue: makePeriodComparison(pipelineValue, pipelineValue),
    };
  }, [revenueByTeamQuery.data, prevWonQuery.data, currentLostQuery.data, prevLostQuery.data, pipelineDealsQuery.data]);

  const isLoading = revenueQuery.isLoading || pipelineQuery.isLoading || teamQuery.isLoading || referralQuery.isLoading || scorecardQuery.isLoading;
  const isError = revenueQuery.isError || pipelineQuery.isError || teamQuery.isError || referralQuery.isError || scorecardQuery.isError;

  return {
    currentMetrics,
    pipelineStages: pipelineQuery.data ?? [],
    teamMembers: teamQuery.data ?? [],
    referrals: referralQuery.data ?? [],
    scorecard: scorecardQuery.data ?? [],
    teamUsers: usersQuery.data ?? [],
    activityHeatmapData,
    sparklineData,
    revenueByTeamMember,
    periodOverPeriod,
    isLoading,
    isError,
    heatmapLoading: heatmapDealsQuery.isLoading || heatmapCommsQuery.isLoading,
    sparklineLoading: sparklineQuery.isLoading,
  };
};
