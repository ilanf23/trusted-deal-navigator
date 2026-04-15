import { useState, useMemo, useCallback, useEffect } from 'react';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { useEmployeeUIState } from '@/contexts/EmployeeUIStateContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Loader2, Kanban, Phone, Mail, Calendar, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData, getDealRevenue } from '@/components/admin/dashboard/useDashboardData';
import { CompactKPITile, CompactKPITileSkeleton } from '@/components/admin/dashboard/CompactKPITile';
import { ActivityHeatmap, ActivityHeatmapSkeleton } from '@/components/admin/dashboard/ActivityHeatmap';
import { PipelineStageBar, PipelineStageBarSkeleton, type PipelineStageData } from '@/components/admin/dashboard/PipelineStageBar';
import NudgesWidget from '@/components/employee/dashboard/NudgesWidget';
import TopActions from '@/components/employee/dashboard/TopActions';
import RevenueChart from '@/components/employee/dashboard/RevenueChart';

export type TimePeriod = 'mtd' | 'ytd' | 'qtd';

const STAGE_WEIGHTS: Record<string, number> = {
  discovery: 0.10,
  pre_qualification: 0.25,
  document_collection: 0.45,
  underwriting: 0.65,
  approval: 0.85,
};

const STAGE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  pre_qualification: 'Pre-Qual',
  document_collection: 'Doc Collection',
  underwriting: 'Underwriting',
  approval: 'Approval',
};

const STAGE_COLORS: Record<string, string> = {
  discovery: 'blue',
  pre_qualification: 'cyan',
  document_collection: 'amber',
  underwriting: 'orange',
  approval: 'emerald',
};

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

const Dashboard = () => {
  const { teamMember } = useTeamMember();
  const { getPageState, setPageState } = useEmployeeUIState();
  const persisted = getPageState('dashboard', {
    timePeriod: 'ytd' as TimePeriod,
    chartPeriod: 'ytd' as TimePeriod,
    calcLoanAmount: '500000',
    calcExtraDeals: '0',
  });

  const [timePeriod, setTimePeriodLocal] = useState<TimePeriod>(persisted.timePeriod);
  const setTimePeriod = useCallback((v: TimePeriod) => {
    setTimePeriodLocal(v);
    setPageState('dashboard', { timePeriod: v, chartPeriod: v });
  }, [setPageState]);

  const { setPageTitle, setSearchComponent } = useAdminTopBar();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setPageTitle('Dashboard');
    return () => { setPageTitle(null); setSearchComponent(null); };
  }, [setPageTitle, setSearchComponent]);

  useEffect(() => {
    setSearchComponent(
      <AdminTopBarSearch value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
    );
  }, [searchTerm, setSearchComponent]);

  const {
    pipelineData, fundedLeads,
    isLoading, isFetching,
    annualGoal, periodOverPeriod, activityHeatmapData, sparklineData,
  } = useDashboardData(timePeriod, teamMember?.id);

  const firstName = teamMember?.name || 'Team';
  const evanId = teamMember?.id;
  const memberSlug = teamMember?.name?.toLowerCase() || '';
  const basePath = `/admin/${memberSlug}`;

  const { data: todaysAppointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['todays-appointments', evanId],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      let query = supabase
        .from('appointments')
        .select('*')
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .order('start_time', { ascending: true })
        .limit(8);
      if (evanId) query = query.eq('team_member_id', evanId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!evanId,
  });

  const hotDeals = useMemo(() => {
    if (!pipelineData) return [];
    const stageWeight: Record<string, number> = {
      approval: 5, underwriting: 4, document_collection: 3,
      pre_qualification: 2, discovery: 1,
    };
    return [...pipelineData]
      .sort((a, b) => {
        const wa = stageWeight[a.status ?? ''] || 0;
        const wb = stageWeight[b.status ?? ''] || 0;
        if (wb !== wa) return wb - wa;
        return (Number(b.deal_value) || 0) - (Number(a.deal_value) || 0);
      })
      .slice(0, 5);
  }, [pipelineData]);

  const [calcLoanAmount, setCalcLoanAmount] = useState<string>(persisted.calcLoanAmount);
  const [calcExtraDeals, setCalcExtraDeals] = useState<string>(persisted.calcExtraDeals);

  const commissionCalc = useMemo(() => {
    const loanAmount = parseFloat(calcLoanAmount) || 0;
    const extraDeals = parseInt(calcExtraDeals) || 0;
    const baseCommission = loanAmount * 0.02;
    const bonusMultiplier = 1 + (extraDeals * 0.10);
    const totalCommission = baseCommission * bonusMultiplier;
    return {
      baseCommission,
      bonusAmount: totalCommission - baseCommission,
      totalCommission,
      bonusPercentage: extraDeals * 10,
    };
  }, [calcLoanAmount, calcExtraDeals]);

  const pipelineStages: PipelineStageData[] = useMemo(() => {
    if (!pipelineData) return [];
    const stageOrder = ['discovery', 'pre_qualification', 'document_collection', 'underwriting', 'approval'];
    const grouped: Record<string, { count: number; value: number; forecast: number }> = {};

    pipelineData.forEach((lead) => {
      const stage = lead.status ?? '';
      if (!grouped[stage]) grouped[stage] = { count: 0, value: 0, forecast: 0 };
      grouped[stage].count++;
      const rev = getDealRevenue(lead);
      grouped[stage].value += rev;
      grouped[stage].forecast += rev * (STAGE_WEIGHTS[stage] || 0.1);
    });

    return stageOrder
      .filter((stage) => grouped[stage])
      .map((stage) => ({
        stageId: stage,
        stageName: STAGE_LABELS[stage] || stage,
        dealCount: grouped[stage].count,
        totalValue: grouped[stage].value,
        weightedForecast: grouped[stage].forecast,
        colorName: STAGE_COLORS[stage],
      }));
  }, [pipelineData]);

  const metrics = useMemo(() => {
    const fundedDeals = fundedLeads || [];
    const totalRevenue = fundedDeals.reduce((sum: number, lead) => sum + getDealRevenue(lead), 0);
    const totalDeals = fundedDeals.length;

    const pipelineLeads = pipelineData || [];
    const pipelineValue = pipelineLeads.reduce((sum, lead) => sum + getDealRevenue(lead), 0);
    const pipelineDeals = pipelineLeads.length;

    const periodGoal = timePeriod === 'mtd' ? annualGoal / 12
      : timePeriod === 'qtd' ? annualGoal / 4
      : annualGoal;
    const goalProgress = periodGoal > 0 ? Math.min(100, Math.round((totalRevenue / periodGoal) * 100)) : 0;

    return { totalRevenue, totalDeals, pipelineValue, pipelineDeals, periodGoal, goalProgress };
  }, [fundedLeads, pipelineData, timePeriod, annualGoal]);

  return (
    <EmployeeLayout>
      <div className="space-y-4" style={{ fontFamily: "'Inter', sans-serif" }}>

        {/* Greeting + unified filter bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-foreground">
              {getGreeting(firstName)}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {format(new Date(), 'EEEE, MMMM d, yyyy')} · {isLoading ? '...' : `${metrics.pipelineDeals} active deal${metrics.pipelineDeals !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <TabsList className="bg-muted/60 rounded-full p-1 h-9">
                {(['mtd', 'qtd', 'ytd'] as const).map((p) => (
                  <TabsTrigger
                    key={p}
                    value={p}
                    className="rounded-full px-4 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-muted data-[state=active]:shadow-sm transition-all"
                  >
                    {p.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* KPI tiles — 5 across on desktop */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <CompactKPITileSkeleton key={i} />)}
          </div>
        ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <CompactKPITile
            label="Revenue"
            value={periodOverPeriod.revenue.current}
            variant="currency"
            deltaAbsolute={periodOverPeriod.revenue.delta}
            deltaPercent={periodOverPeriod.revenue.deltaPercent}
            sparkline={{ values: sparklineData.revenue }}
            comparisonLabel="vs previous period"
          />
          <CompactKPITile
            label="Deals Closed"
            value={periodOverPeriod.deals.current}
            variant="count"
            deltaAbsolute={periodOverPeriod.deals.delta}
            deltaPercent={periodOverPeriod.deals.deltaPercent}
            sparkline={{ values: sparklineData.deals }}
          />
          <CompactKPITile
            label="Pipeline Value"
            value={metrics.pipelineValue}
            variant="currency"
            sparkline={{ values: sparklineData.pipeline }}
            comparisonLabel={`${metrics.pipelineDeals} active deal${metrics.pipelineDeals !== 1 ? 's' : ''}`}
          />
          <CompactKPITile
            label="Win Rate"
            value={periodOverPeriod.winRate.current}
            variant="percentage"
            deltaAbsolute={periodOverPeriod.winRate.delta}
            sparkline={{ values: sparklineData.winRate }}
            comparisonLabel="won / (won + lost)"
          />
          <CompactKPITile
            label="Goal Progress"
            value={metrics.goalProgress}
            variant="percentage"
            sparkline={{ values: sparklineData.goalProgress }}
            comparisonLabel={`${formatCurrency(metrics.totalRevenue)} of ${formatCurrency(metrics.periodGoal)}`}
          />
        </div>
        )}

        {/* Full-width revenue combo chart */}
        <RevenueChart evanId={evanId} annualGoal={annualGoal} />

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column: heatmap + pipeline bar + nudges + top actions */}
          <div className="lg:col-span-2 space-y-4">
            {isLoading ? <ActivityHeatmapSkeleton /> : <ActivityHeatmap data={activityHeatmapData} title="Deal Activity" />}
            {isLoading ? <PipelineStageBarSkeleton /> : <PipelineStageBar stages={pipelineStages} />}
            <NudgesWidget evanId={evanId} />
            <TopActions evanId={evanId} />
          </div>

          {/* Right column: hot deals + schedule + commission + quick links */}
          <div className="space-y-4">
            {/* Hot Deals */}
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Hot Deals</CardTitle>
                  <Link to={`${basePath}/pipeline`}>
                    <Badge variant="outline" className="text-[11px] cursor-pointer hover:bg-muted">Pipeline →</Badge>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="space-y-1.5">
                  {hotDeals.length > 0 ? hotDeals.map((deal) => {
                    const commission = getDealRevenue(deal);
                    return (
                      <div key={deal.id} className="flex items-center gap-2 p-2 rounded-md border hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{deal.name || 'Unnamed Deal'}</p>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {STAGE_LABELS[deal.status] || deal.status}
                        </Badge>
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                          {formatCurrency(commission)}
                        </span>
                      </div>
                    );
                  }) : (
                    <p className="text-center py-4 text-muted-foreground text-xs">No active deals</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Today's Schedule */}
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Today's Schedule</CardTitle>
                  <Link to={`${basePath}/calendar`}>
                    <Badge variant="outline" className="text-[11px] cursor-pointer hover:bg-muted">Calendar →</Badge>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {appointmentsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="max-h-[320px] overflow-y-auto">
                    {Array.from({ length: 11 }, (_, i) => i + 8).map((hour) => {
                      const hourAppts = (todaysAppointments || []).filter((appt) =>
                        new Date(appt.start_time).getHours() === hour,
                      );
                      const isCurrentHour = new Date().getHours() === hour;
                      const isPast = new Date().getHours() > hour;
                      const hourLabel = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;

                      return (
                        <div
                          key={hour}
                          className={cn(
                            'flex border-t border-purple-200 dark:border-purple-800/50',
                            isCurrentHour && 'bg-purple-50 dark:bg-purple-950/30',
                          )}
                          style={{ minHeight: 44 }}
                        >
                          <div className="shrink-0 px-2 py-1.5 text-right border-r border-purple-200 dark:border-purple-800/50" style={{ width: 58 }}>
                            <span className={cn(
                              'text-[10px] font-medium',
                              isCurrentHour ? 'text-purple-800 dark:text-purple-300' : isPast ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400',
                            )}>
                              {hourLabel}
                            </span>
                            {isCurrentHour && (
                              <div className="mt-0.5">
                                <span className="text-[9px] font-semibold text-purple-800 dark:text-purple-300">NOW</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 px-2 py-1 min-w-0">
                            {hourAppts.length > 0 && (
                              <div className="space-y-0.5">
                                {hourAppts.map((appt) => (
                                  <div key={appt.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50">
                                    <p className="text-[11px] font-medium truncate flex-1 text-foreground">
                                      {appt.title}
                                    </p>
                                    <span className="text-[10px] shrink-0 text-purple-800 dark:text-purple-300">
                                      {format(new Date(appt.start_time), 'h:mm a')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Commission Calculator */}
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-semibold">Commission Calculator</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="loanAmount" className="text-[11px]">Loan Amount</Label>
                    <Input
                      id="loanAmount"
                      type="number"
                      value={calcLoanAmount}
                      onChange={(e) => setCalcLoanAmount(e.target.value)}
                      placeholder="500000"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="extraDeals" className="text-[11px]">Extra Deals This Period</Label>
                    <Input
                      id="extraDeals"
                      type="number"
                      min="0"
                      max="10"
                      value={calcExtraDeals}
                      onChange={(e) => setCalcExtraDeals(e.target.value)}
                      placeholder="0"
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">+10% bonus per extra deal</p>
                  </div>
                  <div className="border-t pt-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Base (2%)</span>
                      <span>{formatCurrencyFull(commissionCalc.baseCommission)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400">Bonus (+{commissionCalc.bonusPercentage}%)</span>
                      <span className="text-emerald-600 dark:text-emerald-400">+{formatCurrencyFull(commissionCalc.bonusAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold border-t pt-1.5">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrencyFull(commissionCalc.totalCommission)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
              <CardHeader className="pb-2 px-4 pt-4">
                <CardTitle className="text-sm font-semibold">Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="space-y-0.5">
                  {[
                    { to: `${basePath}/pipeline`, label: 'Pipeline', icon: Kanban },
                    { to: `${basePath}/calls`, label: 'Calls', icon: Phone },
                    { to: `${basePath}/gmail`, label: 'Gmail', icon: Mail },
                    { to: `${basePath}/calendar`, label: 'Calendar', icon: Calendar },
                    { to: `${basePath}/lender-programs`, label: 'Lender Programs', icon: Building2 },
                  ].map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted transition-colors text-xs"
                    >
                      <link.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{link.label}</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </EmployeeLayout>
  );
};

export default Dashboard;
