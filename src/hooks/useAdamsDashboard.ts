import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMemberByName } from '@/hooks/useTeamMemberByName';

export interface AdamMetrics {
  activeDeals: number;
  avgDaysPerDeal: number;
  closingsLast30d: number;
  conversionRate: number;
  lenderRelationships: number;
  pendingTermSheets: number;
}

export interface AdamLenderActivity {
  lender: string;
  activeDeals: number;
  avgRate: string;
  lastDeal: string;
  status: string;
}

export interface AdamTermSheet {
  client: string;
  lender: string;
  amount: string;
  submitted: string;
  status: string;
}

export interface AdamOperationalMetric {
  metric: string;
  value: string;
  target: string;
  progress: number;
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

const formatDaysAgo = (dateStr: string | null): string => {
  if (!dateStr) return 'N/A';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
};

const deriveLenderStatus = (lastContact: string | null): string => {
  if (!lastContact) return 'Dormant';
  const days = Math.floor((Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 14) return 'Active';
  if (days <= 30) return 'Needs Attention';
  return 'Dormant';
};

export const useAdamsDashboard = () => {
  const { data: teamMember } = useTeamMemberByName('Adam');
  const teamMemberId = teamMember?.id;

  // Team performance from view
  const perfQuery = useQuery({
    queryKey: ['adam-team-performance'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_team_performance')
        .select('*')
        .ilike('name', 'Adam')
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  // Lender relationships count
  const lenderCountQuery = useQuery({
    queryKey: ['adam-lender-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lender_programs')
        .select('lender_name');
      if (error) throw error;
      const uniqueLenders = new Set((data ?? []).map((r: any) => r.lender_name));
      return uniqueLenders.size;
    },
  });

  // Deals for Adam
  const dealsQuery = useQuery({
    queryKey: ['adam-deals', teamMemberId],
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

  // Top lender programs for lender activity table
  const lenderActivityQuery = useQuery({
    queryKey: ['adam-lender-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lender_programs')
        .select('lender_name, interest_range, last_contact, call_status')
        .order('last_contact', { ascending: false })
        .limit(100);
      if (error) throw error;
      // Aggregate by lender_name
      const lenderMap = new Map<string, { count: number; avgRate: string; lastContact: string | null; status: string }>();
      for (const row of (data ?? [])) {
        const existing = lenderMap.get(row.lender_name);
        if (!existing) {
          lenderMap.set(row.lender_name, {
            count: 1,
            avgRate: row.interest_range || 'N/A',
            lastContact: row.last_contact,
            status: deriveLenderStatus(row.last_contact),
          });
        } else {
          existing.count += 1;
          if (row.last_contact && (!existing.lastContact || row.last_contact > existing.lastContact)) {
            existing.lastContact = row.last_contact;
            existing.status = deriveLenderStatus(row.last_contact);
          }
        }
      }
      // Sort by count desc, take top 5
      return Array.from(lenderMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([name, info]) => ({
          lender: name,
          activeDeals: info.count,
          avgRate: info.avgRate,
          lastDeal: formatDaysAgo(info.lastContact),
          status: info.status,
        }));
    },
  });

  // Operational goals
  const goalsQuery = useQuery({
    queryKey: ['adam-monthly-goals', teamMemberId],
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

  const pendingStages = ['underwriting', 'negotiation', 'term sheet', 'pre-close'];
  const pendingDeals = deals.filter((d: any) =>
    pendingStages.some(s => (d.stage || '').toLowerCase().includes(s))
  );

  const metrics: AdamMetrics = {
    activeDeals: perf?.active_deals ?? 0,
    avgDaysPerDeal: perf?.avg_days ?? 0,
    closingsLast30d: perf?.closings ?? 0,
    conversionRate: perf?.conversion ?? 0,
    lenderRelationships: lenderCountQuery.data ?? 0,
    pendingTermSheets: pendingDeals.length,
  };

  const lenderActivity: AdamLenderActivity[] = lenderActivityQuery.data ?? [];

  const termSheetsPending: AdamTermSheet[] = pendingDeals.map((d: any) => ({
    client: d.deal_name || 'Unknown',
    lender: d.stage || 'Unknown',
    amount: formatCurrency(d.requested_amount || 0),
    submitted: `${d.days_in_stage || 0} days ago`,
    status: d.stage || 'Unknown',
  }));

  const operationalMetrics: AdamOperationalMetric[] = (goalsQuery.data ?? []).map((g: any) => {
    const current = g.current_value;
    const target = g.target_value;
    const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

    // Format value/target based on the label
    const label = (g.goal_label || '').toLowerCase();
    let valueStr = `${current}`;
    let targetStr = `${target}`;
    if (label.includes('rate') || label.includes('acceptance')) {
      valueStr = `${current}%`;
      targetStr = `${target}%`;
    } else if (label.includes('days') || label.includes('efficiency')) {
      valueStr = `${current} days`;
      targetStr = `${target} days`;
    }

    return {
      metric: g.goal_label,
      value: valueStr,
      target: targetStr,
      progress,
    };
  });

  const isLoading =
    perfQuery.isLoading ||
    dealsQuery.isLoading ||
    lenderCountQuery.isLoading ||
    lenderActivityQuery.isLoading ||
    goalsQuery.isLoading;

  return {
    metrics,
    lenderActivity,
    termSheetsPending,
    operationalMetrics,
    isLoading,
  };
};
