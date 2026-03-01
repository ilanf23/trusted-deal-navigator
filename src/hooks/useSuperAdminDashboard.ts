import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

// Team member URL mapping (kept here since it's a UI concern, not data)
const TEAM_URL_MAP: Record<string, string> = {
  'Brad': '/superadmin/brad',
  'Adam': '/superadmin/adam',
  'Ilan': '/superadmin/ilan',
  'Maura': '/admin/maura',
  'Wendy': '/admin/wendy',
  'Evan': '/admin/dashboard',
};

// Team role mapping from team_members table
const TEAM_ROLE_MAP: Record<string, string> = {
  'Brad': 'Owner',
  'Adam': 'Owner',
  'Ilan': 'Owner',
  'Maura': 'Processor',
  'Wendy': 'Processor',
  'Evan': 'Analyst',
};

export const getTeamMemberUrl = (name: string) => TEAM_URL_MAP[name] || `/admin/${name.toLowerCase()}`;
export const getTeamMemberRole = (name: string) => TEAM_ROLE_MAP[name] || 'Team Member';

export const useSuperAdminDashboard = (timePeriod: TimePeriod) => {
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

  const isLoading = revenueQuery.isLoading || pipelineQuery.isLoading || teamQuery.isLoading || referralQuery.isLoading || scorecardQuery.isLoading;
  const isError = revenueQuery.isError || pipelineQuery.isError || teamQuery.isError || referralQuery.isError || scorecardQuery.isError;

  return {
    currentMetrics,
    pipelineStages: pipelineQuery.data ?? [],
    teamMembers: teamQuery.data ?? [],
    referrals: referralQuery.data ?? [],
    scorecard: scorecardQuery.data ?? [],
    isLoading,
    isError,
  };
};
