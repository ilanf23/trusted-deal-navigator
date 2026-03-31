import { useState, useMemo, useCallback } from 'react';
import EvanLayout from '@/components/evan/EvanLayout';
import { useEvanUIState } from '@/contexts/EvanUIStateContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Loader2, CheckCircle2, Circle, Clock, CalendarDays, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { useDashboardData } from '@/components/admin/dashboard/useDashboardData';
import NudgesWidget from '@/components/evan/dashboard/NudgesWidget';
import TopActions from '@/components/evan/dashboard/TopActions';

export type TimePeriod = 'mtd' | 'ytd' | 'qtd';

const ANNUAL_GOAL = 1500000;

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const getGreeting = (firstName: string) => {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 18) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
};

const isOverdue = (dueDate: string): boolean => {
  return new Date(dueDate) < new Date();
};

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'critical':
      return 'bg-red-100 text-red-700';
    case 'high':
      return 'bg-orange-100 text-orange-700';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700';
    case 'low':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const Dashboard = () => {
  const { teamMember } = useTeamMember();
  const { getPageState, setPageState } = useEvanUIState();
  const persisted = getPageState('dashboard', {
    timePeriod: 'ytd' as TimePeriod,
    chartPeriod: 'ytd' as TimePeriod,
    calcLoanAmount: '500000',
    calcExtraDeals: '0',
  });

  const [timePeriod, setTimePeriodLocal] = useState<TimePeriod>(persisted.timePeriod);

  const setTimePeriod = useCallback((v: TimePeriod) => { setTimePeriodLocal(v); setPageState('dashboard', { timePeriod: v, chartPeriod: v }); }, [setPageState]);

  const {
    leadsData, pipelineData, fundedLeads,
    companyRevenueYTD, companyRevenueMTD,
    tasksData, tasksLoading,
    isLoading, isFetching,
  } = useDashboardData(timePeriod);

  const firstName = teamMember?.name || 'Evan';
  const evanId = teamMember?.id;
  const upcomingTasks = tasksData?.topUrgent || [];

  // Today's scheduled appointments
  const { data: todaysAppointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['evan-todays-appointments'],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .order('start_time', { ascending: true })
        .limit(8);

      if (error) throw error;
      return data;
    },
  });

  // Hot deals — closest to closing
  const hotDeals = useMemo(() => {
    if (!pipelineData) return [];

    const stageWeight: Record<string, number> = {
      approval: 5,
      underwriting: 4,
      document_collection: 3,
      pre_qualification: 2,
      discovery: 1,
    };

    return [...pipelineData]
      .sort((a, b) => {
        const weightA = stageWeight[a.status] || 0;
        const weightB = stageWeight[b.status] || 0;
        if (weightB !== weightA) return weightB - weightA;
        const amountA = a.lead_responses?.[0]?.loan_amount || 0;
        const amountB = b.lead_responses?.[0]?.loan_amount || 0;
        return amountB - amountA;
      })
      .slice(0, 5);
  }, [pipelineData]);

  const metrics = useMemo(() => {
    const fundedDealsWithAmount = fundedLeads?.filter(
      (lead) => lead.lead_responses && lead.lead_responses.length > 0 && lead.lead_responses[0]?.loan_amount
    ) || [];

    const totalLoanVolume = fundedDealsWithAmount.reduce(
      (sum, lead) => sum + (lead.lead_responses?.[0]?.loan_amount || 0), 0
    );
    const totalRevenue = totalLoanVolume * 0.01;
    const totalDeals = fundedDealsWithAmount.length;
    const avgDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;

    const pipelineLeadsWithAmount = pipelineData?.filter(
      (lead) => lead.lead_responses && lead.lead_responses.length > 0
    ) || [];
    const pipelineValue = pipelineLeadsWithAmount.reduce(
      (sum, lead) => sum + (lead.lead_responses?.[0]?.loan_amount || 0) * 0.01, 0
    );
    const pipelineDeals = pipelineData?.length || 0;

    const totalLeadsInPeriod = leadsData?.length || 0;
    const winRate = totalLeadsInPeriod > 0 ? Math.round((totalDeals / totalLeadsInPeriod) * 100) : 0;

    const ytdRevenue = timePeriod === 'mtd' ? companyRevenueMTD : companyRevenueYTD;
    const periodGoal = timePeriod === 'mtd' ? ANNUAL_GOAL / 12 : ANNUAL_GOAL;
    const goalProgress = Math.min(100, Math.round((ytdRevenue / periodGoal) * 100));

    return { totalRevenue, totalDeals, avgDealSize, pipelineValue, pipelineDeals, winRate, ytdRevenue, periodGoal, goalProgress };
  }, [leadsData, pipelineData, fundedLeads, companyRevenueYTD, companyRevenueMTD, timePeriod]);

  if (isLoading) {
    return (
      <EvanLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </EvanLayout>
    );
  }

  const periodLabel = timePeriod === 'mtd' ? 'this month' : 'year to date';

  return (
    <EvanLayout>
      <div className="space-y-6">

        {/* ROW 1: Greeting bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{getGreeting(firstName)}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <TabsList className="bg-muted/50 h-8 p-0.5 rounded-lg">
                <TabsTrigger
                  value="mtd"
                  className="text-xs px-3 h-7 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  MTD
                </TabsTrigger>
                <TabsTrigger
                  value="ytd"
                  className="text-xs px-3 h-7 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  YTD
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* ROW 2: KPI strip — 5 metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Card 1: Revenue */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(metrics.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
            </CardContent>
          </Card>

          {/* Card 2: Deals Closed */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <p className="text-sm text-muted-foreground">Deals Closed</p>
              <p className="text-2xl font-bold mt-1">{metrics.totalDeals}</p>
              <p className="text-xs text-muted-foreground mt-1">
                avg {formatCurrency(metrics.avgDealSize)} per deal
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Pipeline Value */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <p className="text-sm text-muted-foreground">Pipeline Value</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(metrics.pipelineValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.pipelineDeals} active deal{metrics.pipelineDeals !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          {/* Card 4: Win Rate */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold mt-1">{metrics.winRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">lead conversion</p>
            </CardContent>
          </Card>

          {/* Card 5: Goal Progress */}
          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <p className="text-sm text-muted-foreground">Goal Progress</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(metrics.ytdRevenue)}
                <span className="text-sm font-normal text-muted-foreground"> / {formatCurrency(metrics.periodGoal)}</span>
              </p>
              <Progress value={metrics.goalProgress} className="h-1.5 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* ROW 3: Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">

            {/* Section 1: Nudges */}
            <NudgesWidget evanId={evanId} />

            {/* Section 2: Top Actions */}
            <TopActions evanId={evanId} />

            {/* Section 3: Today's Schedule */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Today's Schedule</CardTitle>
                    <CardDescription>Calls & meetings today</CardDescription>
                  </div>
                  <Link to="/admin/evan/calendar">
                    <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">View Calendar →</Badge>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {appointmentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : todaysAppointments && todaysAppointments.length > 0 ? (
                    todaysAppointments.map((appt) => (
                      <div key={appt.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="text-sm font-medium text-muted-foreground w-16 shrink-0">
                          {format(new Date(appt.start_time), 'h:mm a')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{appt.title}</p>
                          {appt.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{appt.description}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {appt.appointment_type || 'Scheduled'}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p>No calls scheduled today</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Hot Deals */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Hot Deals</CardTitle>
                    <CardDescription>Closest to closing</CardDescription>
                  </div>
                  <Link to="/admin/evan/pipeline">
                    <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">Full Pipeline →</Badge>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {hotDeals.length > 0 ? (
                    hotDeals.map((deal) => {
                      const stageLabels: Record<string, string> = {
                        discovery: 'Discovery',
                        pre_qualification: 'Pre-Qual',
                        document_collection: 'Doc Collection',
                        underwriting: 'Underwriting',
                        approval: 'Approval',
                      };
                      const commission = (deal.lead_responses?.[0]?.loan_amount || 0) * 0.02;
                      return (
                        <div key={deal.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{deal.name || 'Unnamed Deal'}</p>
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {stageLabels[deal.status] || deal.status}
                          </Badge>
                          <span className="text-sm font-medium text-green-600 shrink-0">
                            {formatCurrency(commission)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <p>No active deals in pipeline</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>
          {/* RIGHT COLUMN */}
          <div className="lg:col-span-1 rounded-xl border bg-card p-8 flex items-center justify-center min-h-[300px]">
            <p className="text-muted-foreground text-sm">Insights Column — Prompt 3</p>
          </div>
        </div>

      </div>
    </EvanLayout>
  );
};

export default Dashboard;
