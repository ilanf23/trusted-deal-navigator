import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  startOfWeek, endOfDay, addDays, eachDayOfInterval,
  getDaysInMonth, eachMonthOfInterval, differenceInDays,
} from 'date-fns';
export type TimePeriod = 'mtd' | 'ytd' | 'qtd';

const STAGE_WEIGHTS: Record<string, number> = {
  discovery: 0.10,
  pre_qualification: 0.25,
  document_collection: 0.45,
  underwriting: 0.65,
  approval: 0.85,
};

const DEFAULT_FEE_RATE = 0.02;

export type ConfidenceData = {
  score: number;
  status: 'on-track' | 'at-risk' | 'below-target';
  forecast: number;
  pipelineWeighted: number;
  growthRate: number;
};

export interface ActivityDay {
  date: string;
  total: number;
  breakdown?: {
    dealsCreated?: number;
    stageChanges?: number;
    communications?: number;
  };
}

export interface SparklineDataSet {
  revenue: number[];
  deals: number[];
  pipeline: number[];
  winRate: number[];
  goalProgress: number[];
}

export interface PeriodComparison {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number;
}

export interface PeriodOverPeriod {
  revenue: PeriodComparison;
  deals: PeriodComparison;
  winRate: PeriodComparison;
  pipelineValue: PeriodComparison;
}

export interface RevenueBySource {
  source: string;
  revenue: number;
  count: number;
}

// Consistent revenue calculation: use potential_revenue when available,
// otherwise fall back to deal_value * fee_percent (or 2% default).
export function getDealRevenue(deal: {
  potential_revenue?: number | null;
  deal_value?: number | null;
  fee_percent?: number | null;
}): number {
  const pr = Number(deal.potential_revenue);
  if (pr > 0) return pr;
  const dv = Number(deal.deal_value) || 0;
  const fp = deal.fee_percent != null && deal.fee_percent > 0
    ? deal.fee_percent / 100
    : DEFAULT_FEE_RATE;
  return dv * fp;
}

function getPeriodStartUTC(period: TimePeriod): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (period) {
    case 'ytd': return new Date(Date.UTC(y, 0, 1)).toISOString();
    case 'qtd': return new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1)).toISOString();
    case 'mtd': return new Date(Date.UTC(y, m, 1)).toISOString();
  }
}

function getPreviousPeriodRange(period: TimePeriod): { start: string; end: string } {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();

  switch (period) {
    case 'ytd': {
      const start = new Date(Date.UTC(y - 1, 0, 1));
      const end = new Date(Date.UTC(y - 1, m, day, 23, 59, 59));
      return { start: start.toISOString(), end: end.toISOString() };
    }
    case 'qtd': {
      const curQMonth = Math.floor(m / 3) * 3;
      const nowUTC = new Date(Date.UTC(y, m, day));
      const curQStart = new Date(Date.UTC(y, curQMonth, 1));
      const daysIntoQ = differenceInDays(nowUTC, curQStart);
      const prevQMonth = curQMonth - 3;
      const prevY = prevQMonth < 0 ? y - 1 : y;
      const prevM = prevQMonth < 0 ? prevQMonth + 12 : prevQMonth;
      const start = new Date(Date.UTC(prevY, prevM, 1));
      const end = addDays(start, daysIntoQ);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    case 'mtd': {
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m - 1, day, 23, 59, 59));
      return { start: start.toISOString(), end: end.toISOString() };
    }
  }
}

function makePeriodComparison(current: number, previous: number): PeriodComparison {
  const delta = current - previous;
  const deltaPercent = previous > 0
    ? ((current - previous) / previous) * 100
    : current > 0 ? 100 : 0;
  return { current, previous, delta, deltaPercent };
}

export function useDashboardData(timePeriod: TimePeriod, teamMemberId?: string | null) {
  const now = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(now, { weekStartsOn: 1 }), [now]);
  const weekEnd = useMemo(() => endOfDay(addDays(weekStart, 6)), [weekStart]);
  const periodStartISO = getPeriodStartUTC(timePeriod);
  const prevRange = getPreviousPeriodRange(timePeriod);

  // Revenue target from database (replaces hardcoded ANNUAL_GOAL)
  const revenueTargetQuery = useQuery({
    queryKey: ['admin-revenue-target'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revenue_targets')
        .select('target_amount, period_type')
        .eq('period_type', 'annual')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const annualGoal = revenueTargetQuery.data?.target_amount ?? 1500000;

  // Leads analytics — new leads created in period
  const leadsQuery = useQuery({
    queryKey: ['admin-leads-analytics', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id, name, status, source, created_at, won_at, deal_value, potential_revenue, fee_percent, deal_outcome')
        .gte('created_at', periodStartISO);
      if (error) throw error;
      return data;
    },
  });

  // Pipeline analytics — open deals
  const pipelineQuery = useQuery({
    queryKey: ['admin-pipeline-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id, name, status, deal_value, potential_revenue, fee_percent, deal_outcome')
        .eq('deal_outcome', 'open');
      if (error) throw error;
      return data;
    },
  });

  // Won deals in current period
  const fundedQuery = useQuery({
    queryKey: ['admin-funded-analytics', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id, won_at, deal_value, potential_revenue, fee_percent, source')
        .eq('deal_outcome', 'won')
        .gte('won_at', periodStartISO);
      if (error) throw error;
      return data;
    },
  });

  // Lost deals in current period (for proper win rate: won / (won + lost))
  const lostDealsQuery = useQuery({
    queryKey: ['admin-lost-analytics', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id, lost_at')
        .eq('deal_outcome', 'lost')
        .gte('lost_at', periodStartISO);
      if (error) throw error;
      return data;
    },
  });

  // Previous period won deals (for period-over-period comparison)
  const prevFundedQuery = useQuery({
    queryKey: ['admin-prev-funded', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('id, won_at, deal_value, potential_revenue, fee_percent')
        .eq('deal_outcome', 'won')
        .gte('won_at', prevRange.start)
        .lte('won_at', prevRange.end);
      if (error) throw error;
      return data;
    },
  });

  // Previous period lost deals (for period-over-period win rate)
  const prevLostQuery = useQuery({
    queryKey: ['admin-prev-lost', timePeriod],
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
  });

  // Company won deals YTD (always YTD for company revenue banner)
  const companyDealsQuery = useQuery({
    queryKey: ['company-funded-deals-leads'],
    queryFn: async () => {
      const ytdStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();
      const { data } = await supabase
        .from('potential')
        .select('id, name, won_at, deal_value, potential_revenue, fee_percent')
        .eq('deal_outcome', 'won')
        .gte('won_at', ytdStart);
      return (data || []).map(d => ({
        rep_name: d.name,
        fee_earned: getDealRevenue(d),
        funded_at: d.won_at,
      }));
    },
  });

  // Heatmap: deal events + communications over last 90 days
  const heatmapRangeStart = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 89,
  )).toISOString();

  const heatmapDealsQuery = useQuery({
    queryKey: ['dashboard-heatmap-deals'],
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
    queryKey: ['dashboard-heatmap-comms'],
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

  // Sparkline: monthly won/lost deals for last 12 months
  const sparklineStart = new Date(Date.UTC(
    now.getUTCFullYear() - 1, now.getUTCMonth(), 1,
  )).toISOString();

  const sparklineQuery = useQuery({
    queryKey: ['dashboard-sparkline-data'],
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

  // Touchpoints this week
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

  // Tasks overview — scoped to current team member
  const tasksQuery = useQuery({
    queryKey: ['dashboard-tasks-overview', teamMemberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, priority, due_date, is_completed, status, created_at')
        .eq('team_member_id', teamMemberId!)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!teamMemberId,
  });

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
        .from('potential')
        .select('id, status, created_at, converted_at')
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

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

  // --- Derived data ---

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
      total, calls: calls.length, emails: emails.length, texts: texts.length,
      other: other.length, inbound, outbound, totalDuration, dailyTouchpoints,
    };
  }, [touchpointsQuery.data, now, weekStart, weekEnd]);

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
  }, [tasksQuery.data, now]);

  const scorecardData = useMemo(() => {
    const comms = scorecardCommsQuery.data || [];
    const leads = scorecardLeadsQuery.data || [];

    const calls = comms.filter(c => c.communication_type === 'call').length;
    const emails = comms.filter(c => c.communication_type !== 'call').length;
    const newLeads = leads.length;
    const tasksDone = (tasksQuery.data || []).filter(t => t.is_completed && t.created_at && new Date(t.created_at) >= weekStart).length;
    const conversions = leads.filter(l => l.status === 'funded' || l.converted_at).length;

    return { calls, emails, newLeads, tasksDone, conversions };
  }, [scorecardCommsQuery.data, scorecardLeadsQuery.data, tasksQuery.data, weekStart]);

  const lenderData = useMemo(() => {
    const programs = lenderQuery.data || [];
    const totalPrograms = programs.length;
    const withContact = programs.filter(p => p.contact_name).length;
    const recentContacts = programs.filter(p => p.contact_name).slice(0, 3);

    return { totalPrograms, withContact, recentContacts };
  }, [lenderQuery.data]);

  const companyRevenueData = useMemo(() => {
    const deals = companyDealsQuery.data || [];
    const ytd = deals.reduce((sum, d) => sum + d.fee_earned, 0);
    const monthStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const mtd = deals
      .filter(d => d.funded_at && new Date(d.funded_at) >= monthStartDate)
      .reduce((sum, d) => sum + d.fee_earned, 0);
    return { ytd, mtd };
  }, [companyDealsQuery.data, now]);

  // Revenue by source breakdown
  const revenueBySource: RevenueBySource[] = useMemo(() => {
    const funded = fundedQuery.data || [];
    const sourceMap = new Map<string, { revenue: number; count: number }>();
    for (const deal of funded) {
      const src = deal.source || 'Unknown';
      const entry = sourceMap.get(src) || { revenue: 0, count: 0 };
      entry.revenue += getDealRevenue(deal);
      entry.count += 1;
      sourceMap.set(src, entry);
    }
    return Array.from(sourceMap.entries())
      .map(([source, data]) => ({ source, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [fundedQuery.data]);

  // Period-over-period comparison
  const periodOverPeriod: PeriodOverPeriod = useMemo(() => {
    const currentFunded = fundedQuery.data || [];
    const previousFunded = prevFundedQuery.data || [];
    const currentLost = lostDealsQuery.data || [];
    const previousLost = prevLostQuery.data || [];

    const currentRevenue = currentFunded.reduce((sum, d) => sum + getDealRevenue(d), 0);
    const previousRevenue = previousFunded.reduce((sum, d) => sum + getDealRevenue(d), 0);

    const currentWon = currentFunded.length;
    const prevWon = previousFunded.length;

    const currentDecisions = currentWon + currentLost.length;
    const currentWinRate = currentDecisions > 0 ? (currentWon / currentDecisions) * 100 : 0;
    const prevDecisions = prevWon + previousLost.length;
    const prevWinRate = prevDecisions > 0 ? (prevWon / prevDecisions) * 100 : 0;

    const pipelineValue = (pipelineQuery.data || []).reduce(
      (sum, d) => sum + getDealRevenue(d), 0,
    );

    return {
      revenue: makePeriodComparison(currentRevenue, previousRevenue),
      deals: makePeriodComparison(currentWon, prevWon),
      winRate: makePeriodComparison(currentWinRate, prevWinRate),
      pipelineValue: makePeriodComparison(pipelineValue, pipelineValue),
    };
  }, [fundedQuery.data, prevFundedQuery.data, lostDealsQuery.data, prevLostQuery.data, pipelineQuery.data]);

  // Activity heatmap data (last 90 days)
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

    for (let i = 11; i >= 0; i--) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0, 23, 59, 59));
      months.push({ start, end });
    }

    const revenue: number[] = [];
    const dealCounts: number[] = [];
    const winRates: number[] = [];
    const goalProgressArr: number[] = [];
    const monthlyGoal = annualGoal / 12;

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

    return { revenue, deals: dealCounts, pipeline: [], winRate: winRates, goalProgress: goalProgressArr };
  }, [sparklineQuery.data, annualGoal, now]);

  // Confidence score — period-aware, uses real pipeline + revenue data
  // Weighted blend: 40% forecast trajectory (on pace to hit goal?),
  // 30% current progress (actual vs expected at this point),
  // 20% pipeline strength (weighted pipeline covers remaining gap?),
  // 10% growth momentum (accelerating or decelerating revenue trend)
  const confidence: ConfidenceData = useMemo(() => {
    const companyRevenue = timePeriod === 'mtd' ? companyRevenueData.mtd : companyRevenueData.ytd;
    const periodGoal = timePeriod === 'mtd' ? annualGoal / 12
      : timePeriod === 'qtd' ? annualGoal / 4
      : annualGoal;

    const pipeline = pipelineQuery.data || [];
    const pipelineWeighted = pipeline.reduce((sum, d) => {
      const weight = STAGE_WEIGHTS[d.status] || 0.1;
      return sum + (getDealRevenue(d) * weight);
    }, 0);

    let forecast: number;
    if (timePeriod === 'mtd') {
      const dayOfMonth = now.getUTCDate();
      const daysInMonth = getDaysInMonth(now);
      forecast = dayOfMonth > 0 ? (companyRevenue / dayOfMonth) * daysInMonth : 0;
    } else if (timePeriod === 'qtd') {
      const qStart = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
      const qEnd = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3 + 3, 0));
      const daysInQ = differenceInDays(qEnd, qStart) + 1;
      const daysElapsed = differenceInDays(now, qStart) + 1;
      forecast = daysElapsed > 0 ? (companyRevenue / daysElapsed) * daysInQ : 0;
    } else {
      const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const daysInYear = (now.getUTCFullYear() % 4 === 0 && (now.getUTCFullYear() % 100 !== 0 || now.getUTCFullYear() % 400 === 0)) ? 366 : 365;
      const dayOfYear = differenceInDays(now, yearStart) + 1;
      forecast = dayOfYear > 0 ? (companyRevenue / dayOfYear) * daysInYear : 0;
    }

    const deals = companyDealsQuery.data || [];
    let growthRate = 0;
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const months = eachMonthOfInterval({ start: yearStart, end: now });
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

    const forecastScore = Math.min(1, forecast / periodGoal);

    let elapsedFraction: number;
    if (timePeriod === 'mtd') {
      elapsedFraction = now.getUTCDate() / getDaysInMonth(now);
    } else if (timePeriod === 'qtd') {
      const qStartD = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));
      const qEndD = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3 + 3, 0));
      elapsedFraction = differenceInDays(now, qStartD) / Math.max(1, differenceInDays(qEndD, qStartD));
    } else {
      const daysInYear = (now.getUTCFullYear() % 4 === 0 && (now.getUTCFullYear() % 100 !== 0 || now.getUTCFullYear() % 400 === 0)) ? 366 : 365;
      elapsedFraction = differenceInDays(now, new Date(Date.UTC(now.getUTCFullYear(), 0, 1))) / daysInYear;
    }

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
  }, [companyRevenueData, companyDealsQuery.data, pipelineQuery.data, timePeriod, annualGoal, now]);

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
    annualGoal,
    revenueBySource,
    periodOverPeriod,
    activityHeatmapData,
    sparklineData,
    isLoading,
    isFetching,
    callsLoading: touchpointsQuery.isLoading,
    tasksLoading: tasksQuery.isLoading,
    scorecardLoading: scorecardCommsQuery.isLoading || scorecardLeadsQuery.isLoading,
    lenderLoading: lenderQuery.isLoading,
    heatmapLoading: heatmapDealsQuery.isLoading || heatmapCommsQuery.isLoading,
    sparklineLoading: sparklineQuery.isLoading,
  };
}
