import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfYear, startOfMonth, startOfWeek, endOfDay, addDays, eachDayOfInterval } from 'date-fns';
import type { TimePeriod } from '@/pages/admin/Dashboard';

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

  // Company funded deals (existing)
  const companyDealsQuery = useQuery({
    queryKey: ['company-funded-deals', timePeriod],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_funded_deals')
        .select('rep_name, fee_earned')
        .gte('funded_at', periodStart.toISOString());
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });

  // Calls this week (new)
  const callsQuery = useQuery({
    queryKey: ['dashboard-calls-this-week'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
        .select('id, communication_type, direction, duration_seconds, created_at')
        .eq('communication_type', 'call')
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
        .from('evan_tasks')
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
        .from('evan_communications')
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

  // Derived calls data
  const callsData = useMemo(() => {
    const calls = callsQuery.data || [];
    const total = calls.length;
    const inbound = calls.filter(c => c.direction === 'inbound').length;
    const outbound = calls.filter(c => c.direction === 'outbound').length;
    const totalDuration = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);

    // Daily breakdown for mini bar chart
    const days = eachDayOfInterval({ start: weekStart, end: now > weekEnd ? weekEnd : now });
    const dailyCalls = days.map(day => {
      const dayEnd = endOfDay(day);
      const count = calls.filter(c => {
        const d = new Date(c.created_at);
        return d >= day && d <= dayEnd;
      }).length;
      return { day: day.toLocaleDateString('en-US', { weekday: 'short' }), count };
    });

    return { total, inbound, outbound, totalDuration, dailyCalls };
  }, [callsQuery.data]);

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

  const isLoading = leadsQuery.isLoading || pipelineQuery.isLoading || fundedQuery.isLoading;
  const isFetching = leadsQuery.isFetching || pipelineQuery.isFetching || fundedQuery.isFetching;

  return {
    leadsData: leadsQuery.data,
    pipelineData: pipelineQuery.data,
    fundedLeads: fundedQuery.data,
    companyDeals: companyDealsQuery.data,
    callsData,
    tasksData,
    scorecardData,
    lenderData,
    isLoading,
    isFetching,
    callsLoading: callsQuery.isLoading,
    tasksLoading: tasksQuery.isLoading,
    scorecardLoading: scorecardCommsQuery.isLoading || scorecardLeadsQuery.isLoading,
    lenderLoading: lenderQuery.isLoading,
  };
}
