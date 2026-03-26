import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMemberByName } from '@/hooks/useTeamMemberByName';

export interface BradMetrics {
  activeDeals: number;
  avgDaysPerDeal: number;
  closingsLast30d: number;
  conversionRate: number;
  pipelineValue: number;
  projectedFees: number;
}

export interface BradDeal {
  client: string;
  loanAmount: string;
  fee: string;
  stage: string;
  probability: number;
  daysInPipeline: number;
}

export interface BradMeeting {
  client: string;
  type: string;
  time: string;
}

export interface BradReferralPartner {
  name: string;
  deals: number;
  revenue: string;
  lastDeal: string;
}

export interface BradMonthlyGoal {
  label: string;
  current: number;
  target: number;
}

const formatCurrency = (amount: number): string => {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
};

const formatRelativeTime = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, '0');
  const timeStr = `${h}:${m} ${ampm}`;

  if (date >= today && date < tomorrow) {
    return `Today, ${timeStr}`;
  }
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
  if (date >= tomorrow && date < dayAfterTomorrow) {
    return `Tomorrow, ${timeStr}`;
  }
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[date.getDay()]}, ${timeStr}`;
};

const formatDaysAgo = (daysAgo: number): string => {
  if (daysAgo === 0) return 'today';
  if (daysAgo === 1) return '1 day ago';
  return `${daysAgo} days ago`;
};

export const useBradsDashboard = () => {
  const { data: teamMember } = useTeamMemberByName('Brad');
  const teamMemberId = teamMember?.id;

  // Team performance from view
  const perfQuery = useQuery({
    queryKey: ['brad-team-performance'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_team_performance')
        .select('*')
        .ilike('name', 'Brad')
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  // High-value deals
  const dealsQuery = useQuery({
    queryKey: ['brad-deals', teamMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_deals')
        .select('*')
        .eq('team_member_id', teamMemberId!)
        .order('requested_amount', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!teamMemberId,
  });

  // Upcoming meetings
  const meetingsQuery = useQuery({
    queryKey: ['brad-meetings', teamMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('team_member_id', teamMemberId!)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!teamMemberId,
  });

  // Referral partners
  const referralsQuery = useQuery({
    queryKey: ['brad-referral-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_referral_sources')
        .select('*')
        .order('total_revenue', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Monthly goals
  const goalsQuery = useQuery({
    queryKey: ['brad-monthly-goals', teamMemberId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('team_monthly_goals')
        .select('*')
        .eq('team_member_id', teamMemberId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!teamMemberId,
  });

  // Derive metrics
  const perf = perfQuery.data;
  const deals = dealsQuery.data ?? [];

  const pipelineValue = deals.reduce((sum: number, d: any) => sum + (d.requested_amount || 0), 0);
  const projectedFees = deals.reduce((sum: number, d: any) => sum + (d.weighted_fees || 0), 0);

  const metrics: BradMetrics = {
    activeDeals: perf?.active_deals ?? 0,
    avgDaysPerDeal: perf?.avg_days ?? 0,
    closingsLast30d: perf?.closings ?? 0,
    conversionRate: perf?.conversion ?? 0,
    pipelineValue,
    projectedFees,
  };

  const highValueDeals: BradDeal[] = deals.map((d: any) => ({
    client: d.deal_name || 'Unknown',
    loanAmount: formatCurrency(d.requested_amount || 0),
    fee: formatCurrency(d.weighted_fees || 0),
    stage: d.stage || 'Unknown',
    probability: d.requested_amount > 0
      ? Math.min(100, Math.round((d.weighted_fees / (d.requested_amount * 0.01)) * 100) / 100)
      : 0,
    daysInPipeline: d.days_in_stage || 0,
  }));

  const upcomingMeetings: BradMeeting[] = (meetingsQuery.data ?? []).map((m: any) => ({
    client: m.title || 'Meeting',
    type: m.appointment_type || 'General',
    time: formatRelativeTime(m.start_time),
  }));

  const referralPartners: BradReferralPartner[] = (referralsQuery.data ?? []).map((r: any) => ({
    name: r.name,
    deals: 0,
    revenue: formatCurrency(r.total_revenue || 0),
    lastDeal: formatDaysAgo(r.last_contact_days_ago || 0),
  }));

  const monthlyGoals: BradMonthlyGoal[] = (goalsQuery.data ?? []).map((g: any) => ({
    label: g.goal_label,
    current: g.current_value,
    target: g.target_value,
  }));

  const isLoading =
    perfQuery.isLoading ||
    dealsQuery.isLoading ||
    meetingsQuery.isLoading ||
    referralsQuery.isLoading ||
    goalsQuery.isLoading;

  return {
    metrics,
    highValueDeals,
    upcomingMeetings,
    referralPartners,
    monthlyGoals,
    isLoading,
  };
};
