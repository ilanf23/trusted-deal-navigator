import { useState, useMemo, useEffect, useRef } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
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
  TrendingDown,
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
  Clock,
} from 'lucide-react';
import {
  format,
  differenceInDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  eachWeekOfInterval,
  eachMonthOfInterval,
  getYear,
} from 'date-fns';
import { motion } from 'framer-motion';
import { PipelineConnectors } from '@/components/admin/scorecard/PipelineConnectors';


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

// ── Animated number entrance ──

function AnimatedValue({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      className="inline-block"
    >
      {children}
    </motion.span>
  );
}

// ── Pipeline Overview card ──

interface OverviewCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accentColor: string; // e.g. 'blue', 'emerald', 'rose', 'amber'
  index: number;
}

const accentMap: Record<string, { border: string; iconBg: string; iconText: string; valueBg: string }> = {
  blue: { border: 'border-l-blue-500', iconBg: 'bg-blue-50 dark:bg-blue-950/40', iconText: 'text-blue-600 dark:text-blue-400', valueBg: '' },
  emerald: { border: 'border-l-emerald-500', iconBg: 'bg-emerald-50 dark:bg-emerald-950/40', iconText: 'text-emerald-600 dark:text-emerald-400', valueBg: '' },
  rose: { border: 'border-l-rose-500', iconBg: 'bg-rose-50 dark:bg-rose-950/40', iconText: 'text-rose-500 dark:text-rose-400', valueBg: '' },
  amber: { border: 'border-l-amber-500', iconBg: 'bg-amber-50 dark:bg-amber-950/40', iconText: 'text-amber-600 dark:text-amber-400', valueBg: '' },
  violet: { border: 'border-l-violet-500', iconBg: 'bg-violet-50 dark:bg-violet-950/40', iconText: 'text-violet-600 dark:text-violet-400', valueBg: '' },
  admin: { border: 'border-l-admin-blue', iconBg: 'bg-admin-blue-light', iconText: 'text-admin-blue', valueBg: '' },
};

const OverviewCard = ({ icon, label, value, sub, accentColor, index }: OverviewCardProps) => {
  const a = accentMap[accentColor] || accentMap.blue;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
      className="bg-card rounded-xl shadow-sm hover:shadow-card-hover transition-shadow duration-300 border border-border/60 p-4 flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${a.iconBg}`}>
          <span className={`[&>svg]:h-3.5 [&>svg]:w-3.5 ${a.iconText}`}>{icon}</span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-bold leading-none tracking-tight">
        <AnimatedValue delay={index * 0.05}>{value}</AnimatedValue>
      </p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </motion.div>
  );
};

// ── Touchpoint tile ──

interface TouchTileProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accentColor: string;
  index: number;
  featured?: boolean;
}

const TouchTile = ({ icon, label, value, sub, accentColor, index, featured = false }: TouchTileProps) => {
  const a = accentMap[accentColor] || accentMap.blue;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 + index * 0.05, ease: 'easeOut' }}
      className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl text-center transition-shadow duration-300 hover:shadow-sm ${
        featured
          ? `bg-admin-blue-light dark:bg-admin-blue/10 border-2 border-admin-blue/20`
          : 'bg-card border border-border/60'
      } ${featured ? '' : ''}`}
    >
      <div className={`p-2 rounded-lg ${featured ? 'bg-admin-blue/10' : a.iconBg}`}>
        <span className={`[&>svg]:h-4 [&>svg]:w-4 ${featured ? 'text-admin-blue' : a.iconText}`}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold leading-none mt-0.5 ${featured ? 'text-admin-blue' : ''}`}>
        <AnimatedValue delay={0.15 + index * 0.05}>{value}</AnimatedValue>
      </p>
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${featured ? 'text-admin-blue/70' : 'text-muted-foreground'}`}>{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
    </motion.div>
  );
};

// ── Task tile ──

interface TaskTileProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant: 'default' | 'success' | 'danger';
  index: number;
}

const TaskTile = ({ icon, label, value, variant, index }: TaskTileProps) => {
  const styles = {
    default: {
      bg: 'bg-card border border-border/60',
      iconClass: 'text-muted-foreground',
      valueClass: '',
      labelClass: 'text-muted-foreground',
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800',
      iconClass: 'text-emerald-600 dark:text-emerald-400',
      valueClass: 'text-emerald-700 dark:text-emerald-300',
      labelClass: 'text-emerald-600 dark:text-emerald-400',
    },
    danger: {
      bg: value > 0
        ? 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800'
        : 'bg-card border border-border/60',
      iconClass: value > 0 ? 'text-rose-500' : 'text-muted-foreground',
      valueClass: value > 0 ? 'text-rose-600 dark:text-rose-400' : '',
      labelClass: value > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-muted-foreground',
    },
  };
  const s = styles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 + index * 0.05, ease: 'easeOut' }}
      className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl text-center transition-shadow duration-300 hover:shadow-sm ${s.bg}`}
    >
      <span className={`[&>svg]:h-5 [&>svg]:w-5 ${s.iconClass}`}>{icon}</span>
      <p className={`text-2xl font-bold leading-none mt-0.5 ${s.valueClass}`}>
        <AnimatedValue delay={0.3 + index * 0.05}>{value}</AnimatedValue>
      </p>
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${s.labelClass}`}>{label}</p>
    </motion.div>
  );
};

const Scorecard = () => {
  const { teamMember } = useTeamMember();
  const pipelineGridRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const currentWeekYear = getYear(currentWeekStart);
  const currentWeekMonth = currentWeekStart.getMonth();

  const [selectedYear, setSelectedYear] = useState<number>(currentWeekYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentWeekMonth);
  const [selectedWeek, setSelectedWeek] = useState<string>(format(currentWeekStart, 'yyyy-MM-dd'));
  const [repFilter, setRepFilter] = useState<string>('me');
  const [timeMode, setTimeMode] = useState<'week' | 'monthly' | 'ytd' | 'custom'>('week');
  const [customStart, setCustomStart] = useState<string>(format(currentWeekStart, "yyyy-MM-dd'T'HH:mm"));
  const [customEnd, setCustomEnd] = useState<string>(format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), "yyyy-MM-dd'T'HH:mm"));

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Performance Scorecard');
    return () => { setPageTitle(null); };
  }, []);

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
    if (timeMode === 'monthly') {
      const monthStart = startOfMonth(now);
      return { start: monthStart, end: endOfMonth(now) };
    }
    if (timeMode === 'ytd') {
      const yearStart = startOfYear(now);
      return { start: yearStart, end: now };
    }
    // weekly (default)
    const [year, month, day] = selectedWeek.split('-').map(Number);
    const weekStart = new Date(year, month - 1, day);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    return { start: weekStart, end: weekEnd };
  }, [selectedWeek, timeMode, customStart, customEnd, currentWeekStart, now]);

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
        .from('potential')
        .select('id, name, company_name, status, assigned_to, created_at, updated_at');
      if (repFilter === 'me' && evanMember?.id) {
        query = query.eq('assigned_to', evanMember.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: repFilter === 'all' || !!evanMember?.id,
    refetchInterval: 30_000,
  });

  const { data: communications } = useQuery({
    queryKey: ['scorecard-communications', periodStart.toISOString(), periodBoundaries.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('id, communication_type, direction, created_at, lead_id, duration_seconds')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodBoundaries.end.toISOString());
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  const { data: leadActivities } = useQuery({
    queryKey: ['scorecard-activities', periodStart.toISOString(), periodBoundaries.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, entity_id, activity_type, title, content, created_at')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodBoundaries.end.toISOString());
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  // Tasks created OR due within the selected period
  const { data: tasks } = useQuery({
    queryKey: ['scorecard-tasks', periodStart.toISOString(), periodBoundaries.end.toISOString()],
    queryFn: async () => {
      // Fetch tasks created in the period
      const { data: createdInPeriod, error: e1 } = await supabase
        .from('tasks')
        .select('id, title, is_completed, lead_id, created_at, due_date, source, team_member_id')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodBoundaries.end.toISOString());
      if (e1) throw e1;

      // Fetch incomplete tasks whose due_date falls within or before the period end
      // (captures overdue tasks that were created before this period)
      const { data: dueInPeriod, error: e2 } = await supabase
        .from('tasks')
        .select('id, title, is_completed, lead_id, created_at, due_date, source, team_member_id')
        .eq('is_completed', false)
        .not('due_date', 'is', null)
        .lte('due_date', periodBoundaries.end.toISOString());
      if (e2) throw e2;

      // Merge and dedupe by id
      const map = new Map<string, NonNullable<typeof createdInPeriod>[number]>();
      for (const t of (createdInPeriod || [])) map.set(t.id, t);
      for (const t of (dueInPeriod || [])) map.set(t.id, t);
      return Array.from(map.values());
    },
    refetchInterval: 30_000,
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
    refetchInterval: 30_000,
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
    refetchInterval: 30_000,
  });

  const metrics = useMemo(() => {
    if (!allLeads) return null;
    const periodEnd = periodBoundaries.end;

    const userLeadIds = new Set(allLeads.map(l => l.id));

    const scopedComms = repFilter === 'me'
      ? (communications || []).filter(c => !c.lead_id || userLeadIds.has(c.lead_id))
      : (communications || []);

    const scopedActivities = repFilter === 'me'
      ? (leadActivities || []).filter(a => userLeadIds.has(a.entity_id))
      : (leadActivities || []);

    const scopedTasks = repFilter === 'me'
      ? (tasks || []).filter(t =>
          (t.lead_id && userLeadIds.has(t.lead_id)) ||
          (t.team_member_id && teamMember && t.team_member_id === teamMember.id)
        )
      : (tasks || []);

    const scopedEmails = repFilter === 'me'
      ? (followUpEmails || []).filter(e => !e.lead_id || userLeadIds.has(e.lead_id))
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

    // Created: tasks whose created_at falls within the period
    const tasksCreated = scopedTasks.filter((t) => {
      const created = new Date(t.created_at);
      return created >= periodStart && created <= periodEnd;
    }).length;

    // Completed: tasks completed (is_completed=true) that were created in this period
    const tasksCompleted = scopedTasks.filter((t) => {
      const created = new Date(t.created_at);
      return t.is_completed && created >= periodStart && created <= periodEnd;
    }).length;

    // Overdue: incomplete tasks whose due_date is before the period end
    const tasksOverdue = scopedTasks.filter(
      (t) => !t.is_completed && t.due_date && new Date(t.due_date) <= periodEnd
    ).length;

    const recentMovements = stageChanges.slice(0, 10).map((activity) => {
      const lead = allLeads.find((l) => l.id === activity.entity_id);
      return {
        id: activity.id,
        leadName: lead?.name || 'Unknown',
        company: lead?.company_name || '',
        action: activity.title || activity.content || 'Stage changed',
        date: activity.created_at,
      };
    });

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
    };
  }, [allLeads, communications, leadActivities, tasks, followUpEmails, rateWatchSignups, periodStart, periodBoundaries, now, repFilter, teamMember]);

  if (leadsLoading) {
    return (
      <EmployeeLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading scorecard...</p>
          </div>
        </div>
      </EmployeeLayout>
    );
  }

  if (!metrics) return null;

  const periodSub = timeMode === 'week' ? 'this week' : timeMode === 'monthly' ? 'this month' : timeMode === 'ytd' ? 'year to date' : 'this period';

  return (
    <EmployeeLayout>
      <div className="space-y-6 sm:space-y-8 pb-6 sm:pb-10">

        {/* ── Header ── */}
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 mr-auto sm:mr-0">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {format(periodBoundaries.start, 'MMM d')} – {format(periodBoundaries.end, 'MMM d, yyyy')}
            </span>
          </div>

          <Select value={timeMode} onValueChange={(v: 'week' | 'monthly' | 'ytd' | 'custom') => setTimeMode(v)}>
            <SelectTrigger className="h-9 w-[100px] text-sm rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          {timeMode === 'custom' && (
            <>
              <Input
                type="datetime-local"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-9 text-sm w-auto rounded-lg"
              />
              <span className="text-xs text-muted-foreground shrink-0">to</span>
              <Input
                type="datetime-local"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 text-sm w-auto rounded-lg"
              />
            </>
          )}

          <Select value={repFilter} onValueChange={setRepFilter}>
            <SelectTrigger className="h-9 w-[100px] text-sm rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Company</SelectItem>
              <SelectItem value="me">{teamMember?.name || 'Me'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Section 1: Pipeline Overview ── */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Pipeline Overview</h2>
          <div ref={pipelineGridRef} className="relative pt-14">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {/* Chronological: Inflow → Pipeline → Activity → Outcomes */}
              <OverviewCard icon={<UserPlus />} label="New Leads" value={metrics.newLeads} sub={periodSub} accentColor="violet" index={0} />
              <OverviewCard icon={<Users />} label="Active" value={metrics.activeLeads} sub="total pipeline" accentColor="blue" index={1} />
              <OverviewCard icon={<ArrowRightLeft />} label="Stage Moves" value={metrics.stageMovements} sub={periodSub} accentColor="amber" index={2} />
              <OverviewCard icon={<Send />} label="Follow-ups" value={metrics.followUpsSent} sub="7-day sent" accentColor="blue" index={3} />
              <OverviewCard icon={<Trophy />} label="Closed Won" value={metrics.closedWon} sub={periodSub} accentColor="emerald" index={4} />
              <OverviewCard icon={<AlertCircle />} label="Closed Lost" value={metrics.closedLost} sub={periodSub} accentColor="rose" index={5} />
              <OverviewCard icon={<Eye />} label="Rate Watch" value={metrics.rateWatchSignups} sub="signups" accentColor="violet" index={6} />
            </div>
            <PipelineConnectors
              containerRef={pipelineGridRef}
              metrics={{
                activeLeads: metrics.activeLeads,
                newLeads: metrics.newLeads,
                closedWon: metrics.closedWon,
                closedLost: metrics.closedLost,
              }}
            />
          </div>
        </section>

        {/* ── Section 2: Touchpoints ── */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Touchpoints</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <TouchTile icon={<TrendingUp />} label="Total" value={metrics.totalTouchpoints} accentColor="admin" index={0} featured />
            <TouchTile icon={<Phone />} label="All Calls" value={metrics.calls} sub={`${metrics.totalCallMinutes} min`} accentColor="blue" index={1} />
            <TouchTile icon={<PhoneOutgoing />} label="Outbound" value={metrics.outboundCalls} accentColor="emerald" index={2} />
            <TouchTile icon={<PhoneIncoming />} label="Inbound" value={metrics.inboundCalls} accentColor="amber" index={3} />
            <TouchTile icon={<Mail />} label="Emails" value={metrics.emails} accentColor="blue" index={4} />
            <TouchTile icon={<MessageSquare />} label="SMS" value={metrics.sms} accentColor="violet" index={5} />
            <TouchTile icon={<Users />} label="Leads Reached" value={metrics.uniqueLeadsContacted} accentColor="blue" index={6} />
          </div>
        </section>

        {/* ── Section 3 + 4 side by side ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

          {/* Tasks & Follow-ups */}
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Tasks & Follow-ups</h2>
            <div className="grid grid-cols-3 gap-3">
              <TaskTile icon={<ListTodo />} label="Created" value={metrics.tasksCreated} variant="default" index={0} />
              <TaskTile icon={<CheckCircle2 />} label="Completed" value={metrics.tasksCompleted} variant="success" index={1} />
              <TaskTile icon={<Timer />} label="Overdue" value={metrics.tasksOverdue} variant="danger" index={2} />
            </div>
          </section>

          {/* Recent Stage Movements */}
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Recent Stage Movements</h2>
            <Card className="border border-border/60 shadow-sm h-full">
              <CardContent className="p-4">
                {metrics.recentMovements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-center gap-2">
                    <ArrowRightLeft className="h-7 w-7 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No stage movements {periodSub}</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[200px] sm:max-h-[260px] overflow-y-auto pr-1">
                    {metrics.recentMovements.map((movement, idx) => (
                      <motion.div
                        key={movement.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.4 + idx * 0.04 }}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors duration-150"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{movement.leadName}</p>
                          {movement.company && (
                            <p className="text-xs text-muted-foreground truncate">{movement.company}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
                          <Badge variant="secondary" className="text-[11px] px-2 py-0.5 whitespace-nowrap rounded-full">
                            {movement.action}
                          </Badge>
                          <p className="text-[11px] text-muted-foreground">
                            {format(new Date(movement.date), 'MMM d')}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

        </div>

      </div>
    </EmployeeLayout>
  );
};

export default Scorecard;
