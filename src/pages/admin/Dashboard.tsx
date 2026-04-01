import { useState, useMemo, useCallback, useEffect } from 'react';
import EvanLayout from '@/components/evan/EvanLayout';
import { useEvanUIState } from '@/contexts/EvanUIStateContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Loader2, CheckCircle2, Circle, Clock, CalendarDays, Phone, Kanban, Mail, Calendar, Building2, DollarSign, Briefcase, Target, TrendingUp, Flag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import { useDashboardData } from '@/components/admin/dashboard/useDashboardData';
import NudgesWidget from '@/components/evan/dashboard/NudgesWidget';
import TopActions from '@/components/evan/dashboard/TopActions';
import RevenueChart from '@/components/evan/dashboard/RevenueChart';

export type TimePeriod = 'mtd' | 'ytd' | 'qtd';

const ANNUAL_GOAL = 1500000;

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatCurrencyFull = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

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

  // Top bar search
  const { setPageTitle, setSearchComponent } = useAdminTopBar();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setPageTitle('Dashboard');
    return () => {
      setPageTitle(null);
      setSearchComponent(null);
    };
  }, []);

  useEffect(() => {
    setSearchComponent(
      <AdminTopBarSearch value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search deals, contacts, tasks..." />
    );
  }, [searchTerm]);

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

  // Commission calculator state
  const [calcLoanAmount, setCalcLoanAmount] = useState<string>(persisted.calcLoanAmount);
  const [calcExtraDeals, setCalcExtraDeals] = useState<string>(persisted.calcExtraDeals);

  const commissionCalc = useMemo(() => {
    const loanAmount = parseFloat(calcLoanAmount) || 0;
    const extraDeals = parseInt(calcExtraDeals) || 0;
    const baseCommission = loanAmount * 0.02;
    const bonusMultiplier = 1 + (extraDeals * 0.10);
    const totalCommission = baseCommission * bonusMultiplier;
    const bonusAmount = totalCommission - baseCommission;
    return {
      baseCommission,
      bonusAmount,
      totalCommission,
      bonusPercentage: extraDeals * 10,
    };
  }, [calcLoanAmount, calcExtraDeals]);

  // Pipeline grouped by stage
  const pipelineByStage = useMemo(() => {
    if (!pipelineData) return [];

    const stageOrder = ['discovery', 'pre_qualification', 'document_collection', 'underwriting', 'approval'];
    const stageLabels: Record<string, string> = {
      discovery: 'Discovery',
      pre_qualification: 'Pre-Qual',
      document_collection: 'Doc Collection',
      underwriting: 'Underwriting',
      approval: 'Approval',
    };

    const grouped: Record<string, { count: number; value: number }> = {};
    pipelineData.forEach((lead) => {
      const stage = lead.status;
      if (!grouped[stage]) grouped[stage] = { count: 0, value: 0 };
      grouped[stage].count++;
      grouped[stage].value += (lead.lead_responses?.[0]?.loan_amount || 0) * 0.02;
    });

    return stageOrder
      .filter((stage) => grouped[stage])
      .map((stage) => ({
        stage,
        label: stageLabels[stage] || stage,
        count: grouped[stage].count,
        value: grouped[stage].value,
      }));
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
      <div className="space-y-6" style={{ fontFamily: "'Poppins', sans-serif" }}>

        {/* ROW 1: Greeting bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-foreground">
              {getGreeting(firstName)}
            </h1>
            <p className="text-sm text-muted-foreground font-normal mt-1">
              {format(new Date(), 'EEEE, MMMM d, yyyy')} · {metrics.pipelineDeals} active deal{metrics.pipelineDeals !== 1 ? 's' : ''} in pipeline
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <TabsList className="bg-muted/60 rounded-full p-1 h-10">
                <TabsTrigger
                  value="mtd"
                  className="rounded-full px-5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
                >
                  MTD
                </TabsTrigger>
                <TabsTrigger
                  value="ytd"
                  className="rounded-full px-5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all"
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
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Revenue</p>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
            </CardContent>
          </Card>

          {/* Card 2: Deals Closed */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Deals Closed</p>
                <Briefcase className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold">{metrics.totalDeals}</p>
              <p className="text-xs text-muted-foreground mt-1">avg {formatCurrency(metrics.avgDealSize)} per deal</p>
            </CardContent>
          </Card>

          {/* Card 3: Pipeline Value */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <Target className="h-4 w-4 text-violet-500" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(metrics.pipelineValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">{metrics.pipelineDeals} active deal{metrics.pipelineDeals !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>

          {/* Card 4: Win Rate */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <TrendingUp className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold">{metrics.winRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">lead conversion</p>
            </CardContent>
          </Card>

          {/* Card 5: Goal Progress */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Goal Progress</p>
                <Flag className="h-4 w-4 text-rose-500" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(metrics.ytdRevenue)}</p>
              <Progress value={metrics.goalProgress} className="h-2 mt-2" />
              <p className="text-xs text-muted-foreground mt-1">{metrics.goalProgress}% of {formatCurrency(metrics.periodGoal)}</p>
            </CardContent>
          </Card>
        </div>

        {/* ROW 3: Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">

            {/* Revenue Chart */}
            <RevenueChart evanId={evanId} />

            {/* Section 1: Nudges */}
            <NudgesWidget evanId={evanId} />

            {/* Section 2: Top Actions */}
            <TopActions evanId={evanId} />

            {/* Section 3: Today's Schedule — hour-by-hour */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Today's Schedule</CardTitle>
                    <CardDescription>{format(new Date(), 'EEEE, MMMM d')}</CardDescription>
                  </div>
                  <Link to="/admin/evan/calendar">
                    <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">View Calendar →</Badge>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {appointmentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    {Array.from({ length: 11 }, (_, i) => i + 8).map((hour) => {
                      const hourAppts = (todaysAppointments || []).filter((appt) => {
                        const apptHour = new Date(appt.start_time).getHours();
                        return apptHour === hour;
                      });
                      const isCurrentHour = new Date().getHours() === hour;
                      const isPast = new Date().getHours() > hour;
                      const hourLabel = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;

                      return (
                        <div
                          key={hour}
                          className="flex border-t"
                          style={{ borderColor: '#c8bdd6', minHeight: 52, ...(isCurrentHour ? { backgroundColor: '#eee6f6' } : {}) }}
                        >
                          {/* Time label */}
                          <div
                            className="shrink-0 px-3 py-2 text-right"
                            style={{ width: 70, borderRight: '1px solid #c8bdd6' }}
                          >
                            <span
                              className="text-xs font-medium"
                              style={{ color: isCurrentHour ? '#3b2778' : isPast ? '#9ca3af' : '#6b7280' }}
                            >
                              {hourLabel}
                            </span>
                            {isCurrentHour && (
                              <div className="mt-0.5">
                                <span className="text-[10px] font-semibold" style={{ color: '#3b2778' }}>NOW</span>
                              </div>
                            )}
                          </div>

                          {/* Appointments for this hour */}
                          <div className="flex-1 px-3 py-1.5 min-w-0">
                            {hourAppts.length > 0 ? (
                              <div className="space-y-1">
                                {hourAppts.map((appt) => (
                                  <div
                                    key={appt.id}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md"
                                    style={{ backgroundColor: '#f3eef9', border: '1px solid #c8bdd6' }}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[13px] font-medium truncate" style={{ color: '#1a1a2e' }}>
                                        {appt.title}
                                      </p>
                                      {appt.description && (
                                        <p className="text-[11px] truncate" style={{ color: '#6b7280' }}>{appt.description}</p>
                                      )}
                                    </div>
                                    <span className="text-[11px] shrink-0" style={{ color: '#3b2778' }}>
                                      {format(new Date(appt.start_time), 'h:mm a')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
          <div className="lg:col-span-1 space-y-6">

            {/* Section 1: Pipeline Snapshot */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Pipeline Snapshot</CardTitle>
                    <CardDescription>Deals by stage</CardDescription>
                  </div>
                  <Link to="/admin/evan/pipeline">
                    <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">Open Pipeline →</Badge>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pipelineByStage.length > 0 ? (
                    pipelineByStage.map((s) => (
                      <div key={s.stage} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{s.label}</span>
                          <Badge variant="secondary" className="text-xs">{s.count}</Badge>
                        </div>
                        <span className="text-sm font-medium">{formatCurrency(s.value)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No active deals</p>
                  )}
                  <div className="border-t pt-3 flex items-center justify-between">
                    <span className="text-sm font-medium">Total Pipeline</span>
                    <span className="text-base font-bold">{formatCurrency(metrics.pipelineValue)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Commission Calculator */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Commission Calculator</CardTitle>
                <CardDescription>Estimate your earnings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="loanAmount" className="text-xs">Loan Amount</Label>
                    <Input
                      id="loanAmount"
                      type="number"
                      value={calcLoanAmount}
                      onChange={(e) => setCalcLoanAmount(e.target.value)}
                      placeholder="500000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="extraDeals" className="text-xs">Extra Deals This Period</Label>
                    <Input
                      id="extraDeals"
                      type="number"
                      min="0"
                      max="10"
                      value={calcExtraDeals}
                      onChange={(e) => setCalcExtraDeals(e.target.value)}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">+10% bonus per extra deal</p>
                  </div>
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Base (2%)</span>
                      <span>{formatCurrencyFull(commissionCalc.baseCommission)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Bonus (+{commissionCalc.bonusPercentage}%)</span>
                      <span className="text-green-600">+{formatCurrencyFull(commissionCalc.bonusAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t pt-2">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrencyFull(commissionCalc.totalCommission)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Quick Links */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {[
                    { to: '/admin/evan/pipeline', label: 'Pipeline', icon: Kanban },
                    { to: '/admin/evan/calls', label: 'Calls', icon: Phone },
                    { to: '/admin/evan/gmail', label: 'Gmail', icon: Mail },
                    { to: '/admin/evan/calendar', label: 'Calendar', icon: Calendar },
                    { to: '/admin/evan/lender-programs', label: 'Lender Programs', icon: Building2 },
                  ].map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted transition-colors text-sm"
                    >
                      <link.icon className="h-4 w-4 text-muted-foreground" />
                      <span>{link.label}</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

      </div>
    </EvanLayout>
  );
};

export default Dashboard;
