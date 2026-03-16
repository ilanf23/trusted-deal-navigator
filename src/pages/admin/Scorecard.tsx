import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import EvanLayout from '@/components/evan/EvanLayout';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users,
  Phone,
  Mail,
  MessageSquare,
  UserPlus,
  Trophy,
  ArrowRightLeft,
  TrendingUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Send,
  Eye,
  PhoneIncoming,
  PhoneOutgoing,
  ListTodo,
  Timer,
} from 'lucide-react';
import {
  format,
  differenceInDays,
  startOfWeek,
  endOfWeek,
  endOfMonth,
  eachWeekOfInterval,
  eachMonthOfInterval,
  getYear,
} from 'date-fns';


const generateYearOptions = () => {
  const currentYear = getYear(new Date());
  return [currentYear, currentYear - 1, currentYear - 2];
};

const generateWeekOptions = (year: number, month: number) => {
  const monthStart = new Date(year, month, 1);
  const monthEnd = endOfMonth(monthStart);
  const weeks = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 1 }
  );
  return weeks.map((weekStart) => ({
    value: format(weekStart, 'yyyy-MM-dd'),
    label: `Week of ${format(weekStart, 'MMM d')}`,
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  }));
};

const generateMonthOptions = (year: number) => {
  const now = new Date();
  const currentYear = getYear(now);
  const currentMonth = now.getMonth();
  const endMonth = year === currentYear ? currentMonth : 11;
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, endMonth, 1);
  return eachMonthOfInterval({ start: yearStart, end: yearEnd }).map((date) => ({
    value: date.getMonth(),
    label: format(date, 'MMMM'),
  }));
};

// Stat card variants
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  colorClass: string;
  iconColorClass: string;
}

const StatCard = ({ icon, label, value, sub, colorClass, iconColorClass }: StatCardProps) => (
  <Card className={`border-0 shadow-sm ${colorClass}`}>
    <CardContent className="p-3 sm:p-4">
      <div className={`flex items-center gap-1.5 mb-2 ${iconColorClass}`}>
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl sm:text-3xl font-bold leading-none">{value}</p>
      {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5">{sub}</p>}
    </CardContent>
  </Card>
);

// Mini touchpoint tile
interface TouchTileProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accent: string;
}

const TouchTile = ({ icon, label, value, sub, accent }: TouchTileProps) => (
  <div className="flex flex-col items-center justify-center gap-1 p-3 sm:p-4 rounded-xl bg-background border border-border/60 text-center">
    <span className={`[&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5 ${accent}`}>{icon}</span>
    <p className="text-xl sm:text-2xl font-bold leading-none mt-1">{value}</p>
    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">{label}</p>
    {sub && <p className="text-[10px] sm:text-[11px] text-muted-foreground/70">{sub}</p>}
  </div>
);

const Scorecard = () => {
  const { teamMember } = useTeamMember();
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const currentWeekYear = getYear(currentWeekStart);
  const currentWeekMonth = currentWeekStart.getMonth();

  const [selectedYear, setSelectedYear] = useState<number>(currentWeekYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentWeekMonth);
  const [selectedWeek, setSelectedWeek] = useState<string>(format(currentWeekStart, 'yyyy-MM-dd'));
  const [repFilter, setRepFilter] = useState<string>('me');
  const [timeMode, setTimeMode] = useState<'week' | 'custom'>('week');
  const [customStart, setCustomStart] = useState<string>(format(currentWeekStart, "yyyy-MM-dd'T'HH:mm"));
  const [customEnd, setCustomEnd] = useState<string>(format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm"));

  const periodBoundaries = useMemo(() => {
    if (timeMode === 'custom') {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        const fallbackStart = new Date(currentWeekStart);
        fallbackStart.setHours(0, 0, 0, 0);
        return { start: fallbackStart, end: endOfWeek(fallbackStart, { weekStartsOn: 1 }) };
      }
      return { start, end };
    }
    const [year, month, day] = selectedWeek.split('-').map(Number);
    const weekStart = new Date(year, month - 1, day);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    return { start: weekStart, end: weekEnd };
  }, [selectedWeek, timeMode, customStart, customEnd, currentWeekStart]);

  const periodStart = periodBoundaries.start;

  const evanMember = teamMember ? { id: teamMember.id } : null;

  const weekOptions = useMemo(() => generateWeekOptions(selectedYear, selectedMonth), [selectedYear, selectedMonth]);
  const monthOptions = useMemo(() => generateMonthOptions(selectedYear), [selectedYear]);
  const yearOptions = useMemo(() => generateYearOptions(), []);

  const handleYearChange = (year: string) => {
    const newYear = parseInt(year);
    setSelectedYear(newYear);
    const newMonths = generateMonthOptions(newYear);
    const newMonth = newMonths.length > 0 ? newMonths[newMonths.length - 1].value : 0;
    setSelectedMonth(newMonth);
    const newWeeks = generateWeekOptions(newYear, newMonth);
    if (newWeeks.length > 0) setSelectedWeek(newWeeks[newWeeks.length - 1].value);
  };

  const handleMonthChange = (month: string) => {
    const newMonth = parseInt(month);
    setSelectedMonth(newMonth);
    const newWeeks = generateWeekOptions(selectedYear, newMonth);
    if (newWeeks.length > 0) setSelectedWeek(newWeeks[newWeeks.length - 1].value);
  };

  const { data: allLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ['scorecard-all-leads', repFilter, evanMember?.id, selectedWeek],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('id, name, company_name, status, assigned_to, created_at, updated_at');
      if (repFilter === 'me' && evanMember?.id) {
        query = query.eq('assigned_to', evanMember.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: repFilter === 'all' || !!evanMember?.id,
  });

  const { data: communications } = useQuery({
    queryKey: ['scorecard-communications', periodStart.toISOString(), periodBoundaries.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
        .select('id, communication_type, direction, created_at, lead_id, duration_seconds')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodBoundaries.end.toISOString());
      if (error) throw error;
      return data;
    },
  });

  const { data: leadActivities } = useQuery({
    queryKey: ['scorecard-activities', periodStart.toISOString(), periodBoundaries.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('id, lead_id, activity_type, title, content, created_at')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodBoundaries.end.toISOString());
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ['scorecard-tasks', periodStart.toISOString(), periodBoundaries.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('id, title, is_completed, lead_id, created_at, due_date, source, assignee_name')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodBoundaries.end.toISOString());
      if (error) throw error;
      return data;
    },
  });

  const { data: followUpEmails } = useQuery({
    queryKey: ['scorecard-follow-up-emails', periodStart.toISOString(), periodBoundaries.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outbound_emails')
        .select('id, source, created_at, status, lead_id')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodBoundaries.end.toISOString());
      if (error) throw error;
      return data;
    },
  });

  const { data: rateWatchSignups } = useQuery({
    queryKey: ['scorecard-ratewatch-signups', periodStart.toISOString(), periodBoundaries.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ratewatch_questionnaire_responses')
        .select('id, created_at')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodBoundaries.end.toISOString());
      if (error) throw error;
      return data;
    },
  });

  const metrics = useMemo(() => {
    if (!allLeads) return null;
    const periodEnd = periodBoundaries.end;

    // Scope all datasets to the current user's leads when repFilter='me'
    const userLeadIds = new Set(allLeads.map(l => l.id));

    const scopedComms = repFilter === 'me'
      ? (communications || []).filter(c => c.lead_id && userLeadIds.has(c.lead_id))
      : (communications || []);

    const scopedActivities = repFilter === 'me'
      ? (leadActivities || []).filter(a => userLeadIds.has(a.lead_id))
      : (leadActivities || []);

    const scopedTasks = repFilter === 'me'
      ? (tasks || []).filter(t =>
          (t.lead_id && userLeadIds.has(t.lead_id)) ||
          (t.assignee_name && teamMember && t.assignee_name.toLowerCase() === teamMember.name.toLowerCase())
        )
      : (tasks || []);

    const scopedEmails = repFilter === 'me'
      ? (followUpEmails || []).filter(e => e.lead_id && userLeadIds.has(e.lead_id))
      : (followUpEmails || []);

    const newLeadsThisPeriod = allLeads.filter((lead) => {
      const createdAt = new Date(lead.created_at);
      return createdAt >= periodStart && createdAt <= periodEnd;
    });

    const activeLeads = allLeads.filter(
      (lead) => !['funded', 'won', 'lost'].includes(lead.status)
    );
    const closedWon = allLeads.filter((lead) => {
      const updatedAt = new Date(lead.updated_at);
      return (lead.status === 'won' || lead.status === 'funded') && updatedAt >= periodStart && updatedAt <= periodEnd;
    });
    const closedLost = allLeads.filter((lead) => {
      const updatedAt = new Date(lead.updated_at);
      return lead.status === 'lost' && updatedAt >= periodStart && updatedAt <= periodEnd;
    });

    const calls = scopedComms.filter((c) => c.communication_type === 'call');
    const emails = scopedComms.filter((c) => c.communication_type === 'email');
    const sms = scopedComms.filter((c) => c.communication_type === 'sms');
    const inboundCalls = calls.filter((c) => c.direction === 'inbound');
    const outboundCalls = calls.filter((c) => c.direction === 'outbound');
    const totalTouchpoints = scopedComms.length;

    const totalCallMinutes = calls.reduce((sum, call) =>
      sum + (call.duration_seconds || 0) / 60, 0
    );

    const uniqueLeadsContacted = new Set(
      scopedComms.filter((c) => c.lead_id).map((c) => c.lead_id)
    ).size;

    const stageChanges = scopedActivities.filter(
      (a) => a.activity_type === 'stage_change' || a.title?.includes('moved to')
    );

    const tasksCompleted = scopedTasks.filter((t) => t.is_completed).length;
    const tasksCreated = scopedTasks.length;
    const tasksOverdue = scopedTasks.filter(
      (t) => !t.is_completed && t.due_date && new Date(t.due_date) < now
    ).length;

    const recentMovements = stageChanges.slice(0, 10).map((activity) => {
      const lead = allLeads.find((l) => l.id === activity.lead_id);
      return {
        id: activity.id,
        leadName: lead?.name || 'Unknown',
        company: lead?.company_name || '',
        action: activity.title || activity.content || 'Stage changed',
        date: activity.created_at,
      };
    });

    const leadsNeedingAttention = activeLeads.filter((lead) => {
      const lastTouchpoint = scopedComms.find((c) => c.lead_id === lead.id);
      if (!lastTouchpoint) return true;
      return differenceInDays(now, new Date(lastTouchpoint.created_at)) >= 7;
    }).slice(0, 10);

    const followUpEmailsSent = scopedEmails.filter(
      (e) => e.source?.toLowerCase().includes('follow') || e.source?.toLowerCase().includes('nudge') || e.source?.toLowerCase().includes('7day')
    ).length;

    const nudgeTasksCompleted = scopedTasks.filter(
      (t) => t.source === 'nudge' && t.is_completed
    ).length;

    return {
      totalLeads: allLeads.length,
      activeLeads: activeLeads.length,
      newLeads: newLeadsThisPeriod.length,
      closedWon: closedWon.length,
      closedLost: closedLost.length,
      totalTouchpoints,
      calls: calls.length,
      inboundCalls: inboundCalls.length,
      outboundCalls: outboundCalls.length,
      emails: emails.length,
      sms: sms.length,
      totalCallMinutes: Math.round(totalCallMinutes),
      uniqueLeadsContacted,
      stageMovements: stageChanges.length,
      recentMovements,
      tasksCreated,
      tasksCompleted,
      tasksOverdue,
      followUpsSent: followUpEmailsSent + nudgeTasksCompleted,
      rateWatchSignups: rateWatchSignups?.length || 0,
      leadsNeedingAttention,
    };
  }, [allLeads, communications, leadActivities, tasks, followUpEmails, rateWatchSignups, periodStart, periodBoundaries, now, repFilter, teamMember]);

  if (leadsLoading) {
    return (
      <EvanLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading scorecard...</p>
          </div>
        </div>
      </EvanLayout>
    );
  }

  if (!metrics) return null;

  const periodLabel = timeMode === 'custom'
    ? `${format(periodBoundaries.start, 'MMM d, h:mm a')} – ${format(periodBoundaries.end, 'MMM d, yyyy h:mm a')}`
    : `${format(periodBoundaries.start, 'MMM d')} – ${format(periodBoundaries.end, 'MMM d, yyyy')}`;

  return (
    <EvanLayout>
      <div className="space-y-5 sm:space-y-8 pb-5 sm:pb-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Performance Scorecard</h1>
            <p className="text-muted-foreground mt-1 text-sm">{periodLabel}</p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:flex-wrap">
              <Select value={timeMode} onValueChange={(v: 'week' | 'custom') => setTimeMode(v)}>
                <SelectTrigger className="h-9 w-full sm:w-[100px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              {timeMode === 'week' && (
                <>
                  <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                    <SelectTrigger className="h-9 w-full sm:w-[90px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedMonth.toString()} onValueChange={handleMonthChange}>
                    <SelectTrigger className="h-9 w-full sm:w-[120px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((month) => (
                        <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                    <SelectTrigger className="h-9 w-full sm:w-[150px] text-sm">
                      <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekOptions.map((week) => (
                        <SelectItem key={week.value} value={week.value}>{week.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {timeMode === 'custom' && (
                <>
                  <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                    <Input
                      type="datetime-local"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="h-9 text-sm w-full sm:w-auto"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">to</span>
                    <Input
                      type="datetime-local"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="h-9 text-sm w-full sm:w-auto"
                    />
                  </div>
                </>
              )}

              <Select value={repFilter} onValueChange={setRepFilter}>
                <SelectTrigger className="h-9 w-full sm:w-[100px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Company</SelectItem>
                  <SelectItem value="me">{teamMember?.name || 'Me'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Section 1: Pipeline Overview ── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Pipeline Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard
              icon={<Users />}
              label="Active"
              value={metrics.activeLeads}
              sub="total pipeline"
              colorClass="bg-blue-50 dark:bg-blue-950/40"
              iconColorClass="text-blue-600 dark:text-blue-400"
            />
            <StatCard
              icon={<UserPlus />}
              label="New Leads"
              value={metrics.newLeads}
              sub={timeMode === 'custom' ? 'this period' : 'this week'}
              colorClass="bg-violet-50 dark:bg-violet-950/40"
              iconColorClass="text-violet-600 dark:text-violet-400"
            />
            <StatCard
              icon={<Trophy />}
              label="Closed Won"
              value={metrics.closedWon}
              sub={timeMode === 'custom' ? 'this period' : 'this week'}
              colorClass="bg-emerald-50 dark:bg-emerald-950/40"
              iconColorClass="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              icon={<AlertCircle />}
              label="Closed Lost"
              value={metrics.closedLost}
              sub={timeMode === 'custom' ? 'this period' : 'this week'}
              colorClass="bg-rose-50 dark:bg-rose-950/40"
              iconColorClass="text-rose-500 dark:text-rose-400"
            />
            <StatCard
              icon={<ArrowRightLeft />}
              label="Stage Moves"
              value={metrics.stageMovements}
              sub={timeMode === 'custom' ? 'this period' : 'this week'}
              colorClass="bg-amber-50 dark:bg-amber-950/40"
              iconColorClass="text-amber-600 dark:text-amber-400"
            />
            <StatCard
              icon={<Send />}
              label="Follow-ups"
              value={metrics.followUpsSent}
              sub="7-day sent"
              colorClass="bg-cyan-50 dark:bg-cyan-950/40"
              iconColorClass="text-cyan-600 dark:text-cyan-400"
            />
            <StatCard
              icon={<Eye />}
              label="Rate Watch"
              value={metrics.rateWatchSignups}
              sub="signups"
              colorClass="bg-purple-50 dark:bg-purple-950/40"
              iconColorClass="text-purple-600 dark:text-purple-400"
            />
          </div>
        </section>

        {/* ── Section 2: Touchpoints ── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Touchpoints</h2>
          <Card className="border border-border/60">
            <CardContent className="p-3 sm:p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {/* Total — featured, full-width on mobile */}
                <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center gap-1 p-3 sm:p-4 rounded-xl bg-primary/8 border border-primary/20 text-center">
                  <span className="text-primary [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5"><TrendingUp /></span>
                  <p className="text-2xl sm:text-3xl font-bold leading-none mt-1">{metrics.totalTouchpoints}</p>
                  <p className="text-[10px] sm:text-xs font-semibold text-primary/80">Total</p>
                </div>

                <TouchTile icon={<Phone />} label="All Calls" value={metrics.calls} sub={`${metrics.totalCallMinutes} min`} accent="text-blue-500" />
                <TouchTile icon={<PhoneOutgoing />} label="Outbound" value={metrics.outboundCalls} accent="text-emerald-500" />
                <TouchTile icon={<PhoneIncoming />} label="Inbound" value={metrics.inboundCalls} accent="text-amber-500" />
                <TouchTile icon={<Mail />} label="Emails" value={metrics.emails} accent="text-purple-500" />
                <TouchTile icon={<MessageSquare />} label="SMS" value={metrics.sms} accent="text-green-500" />
                <TouchTile icon={<Users />} label="Leads Reached" value={metrics.uniqueLeadsContacted} accent="text-indigo-500" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Section 3 + 4 side by side ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

          {/* Tasks & Follow-ups */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Tasks & Follow-ups</h2>
            <Card className="border border-border/60 h-full">
              <CardContent className="p-3 sm:p-5">
                <div className="grid grid-cols-3 gap-3 h-full">
                  <div className="flex flex-col items-center justify-center gap-1 p-3 sm:p-4 rounded-xl bg-muted/40 border border-border/40 text-center">
                    <ListTodo className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    <p className="text-2xl sm:text-3xl font-bold leading-none mt-1">{metrics.tasksCreated}</p>
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">Created</p>
                  </div>

                  <div className="flex flex-col items-center justify-center gap-1 p-3 sm:p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-center">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-2xl sm:text-3xl font-bold leading-none mt-1 text-emerald-700 dark:text-emerald-300">{metrics.tasksCompleted}</p>
                    <p className="text-[10px] sm:text-xs font-medium text-emerald-600 dark:text-emerald-400">Completed</p>
                  </div>

                  <div className={`flex flex-col items-center justify-center gap-1 p-3 sm:p-4 rounded-xl border text-center ${
                    metrics.tasksOverdue > 0
                      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900'
                      : 'bg-muted/40 border-border/40'
                  }`}>
                    <Timer className={`h-4 w-4 sm:h-5 sm:w-5 ${metrics.tasksOverdue > 0 ? 'text-rose-500' : 'text-muted-foreground'}`} />
                    <p className={`text-2xl sm:text-3xl font-bold leading-none mt-1 ${metrics.tasksOverdue > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                      {metrics.tasksOverdue}
                    </p>
                    <p className={`text-[10px] sm:text-xs font-medium ${metrics.tasksOverdue > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-muted-foreground'}`}>
                      Overdue
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Recent Stage Movements */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Recent Stage Movements</h2>
            <Card className="border border-border/60 h-full">
              <CardContent className="p-3 sm:p-5">
                {metrics.recentMovements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-center gap-2">
                    <ArrowRightLeft className="h-7 w-7 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No stage movements {timeMode === 'custom' ? 'this period' : 'this week'}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[180px] sm:max-h-[260px] overflow-y-auto pr-1">
                    {metrics.recentMovements.map((movement) => (
                      <div
                        key={movement.id}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{movement.leadName}</p>
                          {movement.company && (
                            <p className="text-xs text-muted-foreground truncate">{movement.company}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
                          <Badge variant="secondary" className="text-[11px] px-2 py-0.5 whitespace-nowrap">
                            {movement.action}
                          </Badge>
                          <p className="text-[11px] text-muted-foreground">
                            {format(new Date(movement.date), 'MMM d')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

        </div>

      </div>
    </EvanLayout>
  );
};

export default Scorecard;
