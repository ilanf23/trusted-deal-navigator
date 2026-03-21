import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfYear, startOfMonth, startOfWeek, endOfDay, addDays, eachDayOfInterval, getDaysInMonth, eachMonthOfInterval } from 'date-fns';
import type { TimePeriod } from '@/pages/admin/Dashboard';

const STAGE_WEIGHTS: Record<string, number> = {
  discovery: 0.10,
  pre_qualification: 0.25,
  document_collection: 0.45,
  underwriting: 0.65,
  approval: 0.85,
};

export type ConfidenceData = {
  score: number;
  status: 'on-track' | 'at-risk' | 'below-target';
  forecast: number;
  pipelineWeighted: number;
  growthRate: number;
};

const now = new Date();
const weekStart = startOfWeek(now, { weekStartsOn: 1 });
const weekEnd = endOfDay(addDays(weekStart, 6));

export function useDashboardData(timePeriod: TimePeriod) {
  const periodStart = timePeriod === 'ytd' ? startOfYear(now) : startOfMonth(now);

  // Leads analytics (existing)
  const leadsQuery = useQuery({
    queryKey: ['admin-leads-analytics', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, status, source, created_at, converted_at, lead_responses(loan_amount, funding_amount)')
        .gte('created_at', periodStart.toISOString());
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });

  // Pipeline analytics (existing)
  const pipelineQuery = useQuery({
    queryKey: ['admin-pipeline-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, status, lead_responses(loan_amount, funding_amount)')
        .neq('status', 'funded');
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });

  // Funded leads (existing)
  const fundedQuery = useQuery({
    queryKey: ['admin-funded-analytics', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, converted_at, lead_responses(loan_amount)')
        .eq('status', 'funded')
        .gte('converted_at', periodStart.toISOString());
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });

  // Company funded deals — always fetch YTD from leads table (single source of truth)
  const companyDealsQuery = useQuery({
    queryKey: ['company-funded-deals-leads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, name, converted_at, lead_responses(loan_amount)')
        .eq('status', 'funded')
        .gte('converted_at', startOfYear(now).toISOString());
      return (data || []).map((d: any) => ({
        rep_name: d.name,
        fee_earned: (d.lead_responses?.[0]?.loan_amount || 0) * 0.01,
        funded_at: d.converted_at,
      }));
    },
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });

  // All touchpoints this week (calls, emails, texts, etc.)
  const touchpointsQuery = useQuery({
    queryKey: ['dashboard-touchpoints-this-week'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('id, communication_type, direction, duration_seconds, created_at')
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Tasks overview (new)
  const tasksQuery = useQuery({
    queryKey: ['dashboard-tasks-overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, priority, due_date, is_completed, status, created_at')
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Scorecard data (new) - communications + new leads this week
  const scorecardCommsQuery = useQuery({
    queryKey: ['dashboard-scorecard-comms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('id, communication_type, direction, created_at')
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  const scorecardLeadsQuery = useQuery({
    queryKey: ['dashboard-scorecard-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, status, created_at, converted_at')
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  // Lender programs (new)
  const lenderQuery = useQuery({
    queryKey: ['dashboard-lender-programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lender_programs')
        .select('id, lender_name, program_name, contact_name, last_contact, phone, email')
        .order('last_contact', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Derived touchpoints data
  const touchpointsData = useMemo(() => {
    const comms = touchpointsQuery.data || [];
    const total = comms.length;
    const calls = comms.filter(c => c.communication_type === 'call');
    const emails = comms.filter(c => c.communication_type === 'email');
    const texts = comms.filter(c => c.communication_type === 'text' || c.communication_type === 'sms');
    const other = comms.filter(c => !['call', 'email', 'text', 'sms'].includes(c.communication_type || ''));
    const totalDuration = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const inbound = comms.filter(c => c.direction === 'inbound').length;
    const outbound = comms.filter(c => c.direction === 'outbound').length;

    // Daily breakdown for chart — stacked by type
    const days = eachDayOfInterval({ start: weekStart, end: now > weekEnd ? weekEnd : now });
    const dailyTouchpoints = days.map(day => {
      const dayEnd = endOfDay(day);
      const dayComms = comms.filter(c => {
        const d = new Date(c.created_at);
        return d >= day && d <= dayEnd;
      });
      return {
        day: day.toLocaleDateString('en-US', { weekday: 'short' }),
        calls: dayComms.filter(c => c.communication_type === 'call').length,
        emails: dayComms.filter(c => c.communication_type === 'email').length,
        texts: dayComms.filter(c => c.communication_type === 'text' || c.communication_type === 'sms').length,
        total: dayComms.length,
      };
    });

    return {
      total,
      calls: calls.length,
      emails: emails.length,
      texts: texts.length,
      other: other.length,
      inbound,
      outbound,
      totalDuration,
      dailyTouchpoints,
    };
  }, [touchpointsQuery.data]);

  // Derived tasks data
  const tasksData = useMemo(() => {
    const tasks = tasksQuery.data || [];
    const todayEnd = endOfDay(now);
    const weekEndDate = endOfDay(addDays(now, 7));

    const overdue = tasks.filter(t => !t.is_completed && t.due_date && new Date(t.due_date) < now);
    const today = tasks.filter(t => !t.is_completed && t.due_date && new Date(t.due_date) >= now && new Date(t.due_date) <= todayEnd);
    const thisWeek = tasks.filter(t => !t.is_completed && t.due_date && new Date(t.due_date) > todayEnd && new Date(t.due_date) <= weekEndDate);
    const done = tasks.filter(t => t.is_completed);
    const topUrgent = [...overdue, ...today].slice(0, 5);

    return { overdue: overdue.length, today: today.length, thisWeek: thisWeek.length, done: done.length, topUrgent };
  }, [tasksQuery.data]);

  // Derived scorecard data
  const scorecardData = useMemo(() => {
    const comms = scorecardCommsQuery.data || [];
    const leads = scorecardLeadsQuery.data || [];

    const calls = comms.filter(c => c.communication_type === 'call').length;
    const emails = comms.filter(c => c.communication_type !== 'call').length;
    const newLeads = leads.length;
    const tasksDone = (tasksQuery.data || []).filter(t => t.is_completed && t.created_at && new Date(t.created_at) >= weekStart).length;
    const conversions = leads.filter(l => l.status === 'funded' || l.converted_at).length;

    return { calls, emails, newLeads, tasksDone, conversions };
  }, [scorecardCommsQuery.data, scorecardLeadsQuery.data, tasksQuery.data]);

  // Derived lender data
  const lenderData = useMemo(() => {
    const programs = lenderQuery.data || [];
    const totalPrograms = programs.length;
    const withContact = programs.filter(p => p.contact_name).length;
    const recentContacts = programs.filter(p => p.contact_name).slice(0, 3);

    return { totalPrograms, withContact, recentContacts };
  }, [lenderQuery.data]);

  // Derived company revenue — always available as both MTD and YTD
  const companyRevenueData = useMemo(() => {
    const deals = companyDealsQuery.data || [];
    const ytd = deals.reduce((sum, d) => sum + d.fee_earned, 0);
    const monthStart = startOfMonth(now);
    const mtd = deals
      .filter(d => d.funded_at && new Date(d.funded_at) >= monthStart)
      .reduce((sum, d) => sum + d.fee_earned, 0);
    return { ytd, mtd };
  }, [companyDealsQuery.data]);

  // Unified confidence score — period-aware, uses real pipeline + revenue data
  const confidence: ConfidenceData = useMemo(() => {
    const companyRevenue = timePeriod === 'mtd' ? companyRevenueData.mtd : companyRevenueData.ytd;
    const ANNUAL_GOAL = 1500000;
    const periodGoal = timePeriod === 'mtd' ? ANNUAL_GOAL / 12 : ANNUAL_GOAL;

    // Pipeline weighted revenue from real pipeline data
    const pipeline = pipelineQuery.data || [];
    const pipelineWeighted = pipeline.reduce((sum, d) => {
      const weight = STAGE_WEIGHTS[d.status] || 0.1;
      const loanAmount = d.lead_responses?.[0]?.loan_amount || 0;
      return sum + (loanAmount * 0.01 * weight);
    }, 0);

    // Pace: extrapolate current revenue to end of period
    let forecast: number;
    if (timePeriod === 'mtd') {
      const dayOfMonth = now.getDate();
      const daysInMonth = getDaysInMonth(now);
      forecast = dayOfMonth > 0 ? (companyRevenue / dayOfMonth) * daysInMonth : 0;
    } else {
      const monthsElapsed = Math.max(0.1, now.getMonth() + now.getDate() / 30);
      forecast = (companyRevenue / monthsElapsed) * 12;
    }

    // Growth momentum from company deals
    const deals = companyDealsQuery.data || [];
    let growthRate = 0;
    if (timePeriod === 'ytd') {
      const months = eachMonthOfInterval({ start: startOfYear(now), end: now });
      const monthlyRevenues = months.map(month => {
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        return deals
          .filter(d => {
            const f = d.funded_at ? new Date(d.funded_at) : null;
            return f && f >= month && f <= monthEnd;
          })
          .reduce((s, d) => s + Number(d.fee_earned), 0);
      });
      const active = monthlyRevenues.filter(r => r > 0);
      if (active.length > 1) {
        growthRate = Math.round(((active[active.length - 1] - active[0]) / Math.max(1, active[0])) * 100);
      }
    }

    // Weighted confidence blend:
    // 40% forecast trajectory — can we hit goal at current pace?
    // 30% current progress — where are we vs where we should be?
    // 20% pipeline strength — does pipeline cover the remaining gap?
    // 10% growth momentum — are we accelerating or decelerating?
    const forecastScore = Math.min(1, forecast / periodGoal);
    const elapsedFraction = timePeriod === 'mtd'
      ? now.getDate() / getDaysInMonth(now)
      : (now.getMonth() + now.getDate() / 30) / 12;
    const expectedRevenue = periodGoal * elapsedFraction;
    const progressScore = expectedRevenue > 0 ? Math.min(1, companyRevenue / expectedRevenue) : 0;
    const remainingGap = Math.max(0, periodGoal - companyRevenue);
    const pipelineScore = remainingGap > 0 ? Math.min(1, pipelineWeighted / remainingGap) : 1;
    const momentumScore = growthRate > 0 ? Math.min(1, growthRate / 100) : growthRate === 0 ? 0.5 : Math.max(0, 0.5 + growthRate / 200);

    const raw = (forecastScore * 0.4) + (progressScore * 0.3) + (pipelineScore * 0.2) + (momentumScore * 0.1);
    const score = Math.min(99, Math.max(1, Math.round(raw * 100)));
    const status: ConfidenceData['status'] =
      score >= 65 ? 'on-track' : score >= 40 ? 'at-risk' : 'below-target';

    return { score, status, forecast, pipelineWeighted, growthRate };
  }, [companyRevenueData, companyDealsQuery.data, pipelineQuery.data, timePeriod]);

  const isLoading = leadsQuery.isLoading || pipelineQuery.isLoading || fundedQuery.isLoading;
  const isFetching = leadsQuery.isFetching || pipelineQuery.isFetching || fundedQuery.isFetching;

  return {
    leadsData: leadsQuery.data,
    pipelineData: pipelineQuery.data,
    fundedLeads: fundedQuery.data,
    companyRevenueYTD: companyRevenueData.ytd,
    companyRevenueMTD: companyRevenueData.mtd,
    confidence,
    touchpointsData,
    tasksData,
    scorecardData,
    lenderData,
    isLoading,
    isFetching,
    callsLoading: touchpointsQuery.isLoading,
    tasksLoading: tasksQuery.isLoading,
    scorecardLoading: scorecardCommsQuery.isLoading || scorecardLeadsQuery.isLoading,
    lenderLoading: lenderQuery.isLoading,
  };
}
