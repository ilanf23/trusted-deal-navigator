import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import EvanLayout from '@/components/evan/EvanLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Clock,
  ArrowRight,
  Calendar,
  Send,
  Eye,
} from 'lucide-react';
import { 
  startOfMonth, 
  format, 
  differenceInDays, 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  subWeeks, 
  startOfYear, 
  endOfMonth,
  eachWeekOfInterval,
  eachMonthOfInterval,
  getYear,
} from 'date-fns';
import { Link } from 'react-router-dom';

// Stage labels for display
const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  discovery: 'Initial Consult',
  pre_qualification: 'Onboarding',
  document_collection: 'Underwriting',
  underwriting: 'Lender Mgmt',
  approval: 'Path to Close',
  funded: 'Funded',
  lost: 'Lost',
};

// Generate years for filter (current year and 2 previous years)
const generateYearOptions = () => {
  const currentYear = getYear(new Date());
  return [currentYear, currentYear - 1, currentYear - 2];
};

// Generate weeks for a given year and month (weeks identified by Monday date)
const generateWeekOptions = (year: number, month: number) => {
  const monthStart = new Date(year, month, 1);
  const monthEnd = endOfMonth(monthStart);
  
  // Get all weeks that have any days in this month
  const weeks = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 1 } // Monday
  );
  
  return weeks.map((weekStart) => ({
    value: format(weekStart, 'yyyy-MM-dd'),
    label: `Week of ${format(weekStart, 'MMM d')}`,
    start: weekStart,
    end: endOfWeek(weekStart, { weekStartsOn: 1 }),
  }));
};

// Generate month options for a given year
const generateMonthOptions = (year: number) => {
  const now = new Date();
  const currentYear = getYear(now);
  const currentMonth = now.getMonth();
  
  // If it's the current year, only show months up to current month
  const endMonth = year === currentYear ? currentMonth : 11;
  
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, endMonth, 1);
  
  return eachMonthOfInterval({ start: yearStart, end: yearEnd }).map((date) => ({
    value: date.getMonth(),
    label: format(date, 'MMMM'),
  }));
};

const EvansScorecard = () => {
  const now = new Date();
  
  // Initialize with current week's Monday
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  
  // Use the week start's month/year so the filter always shows the current week
  const currentWeekYear = getYear(currentWeekStart);
  const currentWeekMonth = currentWeekStart.getMonth();
  
  const [selectedYear, setSelectedYear] = useState<number>(currentWeekYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentWeekMonth);
  const [selectedWeek, setSelectedWeek] = useState<string>(format(currentWeekStart, 'yyyy-MM-dd'));
  const [repFilter, setRepFilter] = useState<string>('evan');

  // Compute period boundaries based on selected week
  // Parse the date as local time to avoid timezone offset issues
  const periodBoundaries = useMemo(() => {
    const [year, month, day] = selectedWeek.split('-').map(Number);
    const weekStart = new Date(year, month - 1, day);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    return { start: weekStart, end: weekEnd };
  }, [selectedWeek]);

  const periodStart = periodBoundaries.start;

  // Get Evan's team member ID for filtering
  const { data: evanMember } = useQuery({
    queryKey: ['evan-member-id'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id')
        .eq('name', 'Evan')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Memoize week options based on selected year and month
  const weekOptions = useMemo(() => 
    generateWeekOptions(selectedYear, selectedMonth), 
    [selectedYear, selectedMonth]
  );

  // Memoize month options based on selected year
  const monthOptions = useMemo(() => 
    generateMonthOptions(selectedYear), 
    [selectedYear]
  );

  const yearOptions = useMemo(() => generateYearOptions(), []);

  // When year or month changes, reset week to first week of that month
  const handleYearChange = (year: string) => {
    const newYear = parseInt(year);
    setSelectedYear(newYear);
    const newMonths = generateMonthOptions(newYear);
    const newMonth = newMonths.length > 0 ? newMonths[newMonths.length - 1].value : 0;
    setSelectedMonth(newMonth);
    const newWeeks = generateWeekOptions(newYear, newMonth);
    if (newWeeks.length > 0) {
      setSelectedWeek(newWeeks[newWeeks.length - 1].value);
    }
  };

  const handleMonthChange = (month: string) => {
    const newMonth = parseInt(month);
    setSelectedMonth(newMonth);
    const newWeeks = generateWeekOptions(selectedYear, newMonth);
    if (newWeeks.length > 0) {
      setSelectedWeek(newWeeks[newWeeks.length - 1].value);
    }
  };

  // Fetch all leads (for counting new leads this period)
  const { data: allLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ['scorecard-all-leads', repFilter, evanMember?.id, selectedWeek],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('id, name, company_name, status, assigned_to, created_at, updated_at');
      
      if (repFilter === 'evan' && evanMember?.id) {
        query = query.eq('assigned_to', evanMember.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: repFilter === 'all' || !!evanMember?.id,
  });

  // Fetch communications (touchpoints)
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

  // Fetch lead activities (for stage movements)
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

  // Fetch tasks for follow-up tracking
  const { data: tasks } = useQuery({
    queryKey: ['scorecard-tasks', periodStart.toISOString(), periodBoundaries.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('id, title, is_completed, lead_id, created_at, due_date, source')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodBoundaries.end.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Fetch 7-day follow-up emails sent
  const { data: followUpEmails } = useQuery({
    queryKey: ['scorecard-follow-up-emails', periodStart.toISOString(), periodBoundaries.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outbound_emails')
        .select('id, source, created_at, status')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodBoundaries.end.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Fetch Rate Watch signups
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

  // Calculate lead-centric metrics
  const metrics = useMemo(() => {
    if (!allLeads) return null;

    const periodEnd = periodBoundaries.end;

    // New leads this period (within the selected week)
    const newLeadsThisPeriod = allLeads.filter((lead) => {
      const createdAt = new Date(lead.created_at);
      return createdAt >= periodStart && createdAt <= periodEnd;
    });

    // Leads by status
    const activeLeads = allLeads.filter(
      (lead) => !['funded', 'lost'].includes(lead.status)
    );
    const closedWon = allLeads.filter((lead) => {
      const updatedAt = new Date(lead.updated_at);
      return lead.status === 'funded' && updatedAt >= periodStart && updatedAt <= periodEnd;
    });
    const closedLost = allLeads.filter((lead) => {
      const updatedAt = new Date(lead.updated_at);
      return lead.status === 'lost' && updatedAt >= periodStart && updatedAt <= periodEnd;
    });

    // Touchpoints breakdown
    const calls = communications?.filter((c) => c.communication_type === 'call') || [];
    const emails = communications?.filter((c) => c.communication_type === 'email') || [];
    const sms = communications?.filter((c) => c.communication_type === 'sms') || [];
    
    const inboundCalls = calls.filter((c) => c.direction === 'inbound');
    const outboundCalls = calls.filter((c) => c.direction === 'outbound');
    
    const totalTouchpoints = (communications?.length || 0);

    // Calculate total call duration in minutes
    const totalCallMinutes = calls.reduce((sum, call) => 
      sum + (call.duration_seconds || 0) / 60, 0
    );

    // Unique leads contacted
    const uniqueLeadsContacted = new Set(
      communications?.filter((c) => c.lead_id).map((c) => c.lead_id) || []
    ).size;

    // Stage movements from activities
    const stageChanges = leadActivities?.filter(
      (a) => a.activity_type === 'stage_change' || a.title?.includes('moved to')
    ) || [];

    // Tasks metrics
    const tasksCompleted = tasks?.filter((t) => t.is_completed).length || 0;
    const tasksCreated = tasks?.length || 0;
    const tasksOverdue = tasks?.filter(
      (t) => !t.is_completed && t.due_date && new Date(t.due_date) < now
    ).length || 0;

    // Recent stage movements for display
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

    // Leads needing attention (no touchpoint in 7+ days)
    const leadsNeedingAttention = activeLeads.filter((lead) => {
      const lastTouchpoint = communications?.find((c) => c.lead_id === lead.id);
      if (!lastTouchpoint) return true;
      return differenceInDays(now, new Date(lastTouchpoint.created_at)) >= 7;
    }).slice(0, 10);

    // 7-day follow-ups sent (from outbound_emails with follow_up/7day sources or nudge tasks)
    const followUpEmailsSent = followUpEmails?.filter(
      (e) => e.source?.toLowerCase().includes('follow') || e.source?.toLowerCase().includes('nudge') || e.source?.toLowerCase().includes('7day')
    ).length || 0;
    
    const nudgeTasksCompleted = tasks?.filter(
      (t) => t.source === 'nudge' && t.is_completed
    ).length || 0;

    const totalFollowUpsSent = followUpEmailsSent + nudgeTasksCompleted;

    // Rate Watch signups this period
    const rateWatchSignupsCount = rateWatchSignups?.length || 0;

    return {
      // Lead counts
      totalLeads: allLeads.length,
      activeLeads: activeLeads.length,
      newLeads: newLeadsThisPeriod.length,
      closedWon: closedWon.length,
      closedLost: closedLost.length,
      
      // Touchpoints
      totalTouchpoints,
      calls: calls.length,
      inboundCalls: inboundCalls.length,
      outboundCalls: outboundCalls.length,
      emails: emails.length,
      sms: sms.length,
      totalCallMinutes: Math.round(totalCallMinutes),
      uniqueLeadsContacted,
      
      // Stage movements
      stageMovements: stageChanges.length,
      recentMovements,
      
      // Tasks
      tasksCreated,
      tasksCompleted,
      tasksOverdue,
      
      // New metrics
      followUpsSent: totalFollowUpsSent,
      rateWatchSignups: rateWatchSignupsCount,
      
      // Attention needed
      leadsNeedingAttention,
    };
  }, [allLeads, communications, leadActivities, tasks, followUpEmails, rateWatchSignups, periodStart, periodBoundaries, now]);

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

  return (
    <EvanLayout>
      <div className="space-y-6">
        {/* Header with Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Lead Scorecard</h1>
            <p className="text-muted-foreground">Track your lead activity & performance</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Year filter */}
            <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Month filter */}
            <Select value={selectedMonth.toString()} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Week filter */}
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((week) => (
                  <SelectItem key={week.value} value={week.value}>
                    {week.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Rep filter */}
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="w-[110px]">
                <SelectValue placeholder="Evan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Company</SelectItem>
                <SelectItem value="evan">Evan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Section 1: Lead Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="bg-gradient-to-br from-blue-400/25 to-blue-500/35 dark:from-blue-600/35 dark:to-blue-700/45 border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-300 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Active Leads</span>
              </div>
              <p className="text-3xl font-bold">{metrics.activeLeads}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/30 to-blue-600/40 dark:from-blue-700/40 dark:to-blue-800/50 border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-300 mb-1">
                <UserPlus className="h-4 w-4" />
                <span className="text-xs font-medium">New Leads</span>
              </div>
              <p className="text-3xl font-bold">{metrics.newLeads}</p>
              <p className="text-xs text-muted-foreground">this period</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-600/35 to-blue-700/45 dark:from-blue-800/45 dark:to-blue-900/55 border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-300 mb-1">
                <Trophy className="h-4 w-4" />
                <span className="text-xs font-medium">Closed Won</span>
              </div>
              <p className="text-3xl font-bold">{metrics.closedWon}</p>
              <p className="text-xs text-muted-foreground">this period</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-700/40 to-blue-800/50 dark:from-blue-900/50 dark:to-blue-950/60 border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-500 dark:text-blue-300 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Closed Lost</span>
              </div>
              <p className="text-3xl font-bold">{metrics.closedLost}</p>
              <p className="text-xs text-muted-foreground">this period</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-800/45 to-blue-900/55 dark:from-blue-950/55 dark:to-slate-900/65 border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400 dark:text-blue-300 mb-1">
                <ArrowRightLeft className="h-4 w-4" />
                <span className="text-xs font-medium">Stage Moves</span>
              </div>
              <p className="text-3xl font-bold">{metrics.stageMovements}</p>
              <p className="text-xs text-muted-foreground">this period</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/30 to-emerald-600/40 dark:from-emerald-700/40 dark:to-emerald-800/50 border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300 mb-1">
                <Send className="h-4 w-4" />
                <span className="text-xs font-medium">7-Day Follow-ups</span>
              </div>
              <p className="text-3xl font-bold">{metrics.followUpsSent}</p>
              <p className="text-xs text-muted-foreground">sent this period</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/30 to-purple-600/40 dark:from-purple-700/40 dark:to-purple-800/50 border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-300 mb-1">
                <Eye className="h-4 w-4" />
                <span className="text-xs font-medium">Rate Watch Signups</span>
              </div>
              <p className="text-3xl font-bold">{metrics.rateWatchSignups}</p>
              <p className="text-xs text-muted-foreground">this period</p>
            </CardContent>
          </Card>
        </div>

        {/* Section 2: Touchpoints */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Touchpoints This Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-primary">{metrics.totalTouchpoints}</p>
                <p className="text-sm text-muted-foreground">Total Touchpoints</p>
              </div>
              
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Phone className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.calls}</p>
                <p className="text-xs text-muted-foreground">Calls</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.totalCallMinutes} mins
                </p>
              </div>

              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Phone className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.outboundCalls}</p>
                <p className="text-xs text-muted-foreground">Outbound</p>
              </div>

              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Phone className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.inboundCalls}</p>
                <p className="text-xs text-muted-foreground">Inbound</p>
              </div>
              
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Mail className="h-4 w-4 text-purple-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.emails}</p>
                <p className="text-xs text-muted-foreground">Emails</p>
              </div>
              
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <MessageSquare className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.sms}</p>
                <p className="text-xs text-muted-foreground">SMS</p>
              </div>

              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users className="h-4 w-4 text-indigo-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.uniqueLeadsContacted}</p>
                <p className="text-xs text-muted-foreground">Leads Reached</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Tasks & Follow-ups */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Tasks & Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-3xl font-bold">{metrics.tasksCreated}</p>
                <p className="text-sm text-muted-foreground">Tasks Created</p>
              </div>
              
              <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                <p className="text-3xl font-bold text-emerald-600">{metrics.tasksCompleted}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
              
              <div className={`text-center p-4 rounded-lg ${metrics.tasksOverdue > 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-muted/30'}`}>
                <p className={`text-3xl font-bold ${metrics.tasksOverdue > 0 ? 'text-red-600' : ''}`}>
                  {metrics.tasksOverdue}
                </p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Recent Stage Movements */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Recent Stage Movements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.recentMovements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No stage movements this period</p>
              </div>
            ) : (
              <div className="space-y-2">
                {metrics.recentMovements.map((movement) => (
                  <div 
                    key={movement.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{movement.leadName}</p>
                      {movement.company && (
                        <p className="text-xs text-muted-foreground">{movement.company}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {movement.action}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(movement.date), 'MMM d')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </EvanLayout>
  );
};

export default EvansScorecard;
