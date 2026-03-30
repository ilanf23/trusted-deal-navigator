import { useState, useMemo, useCallback } from 'react';
import EvanLayout from '@/components/evan/EvanLayout';
import { useEvanUIState } from '@/contexts/EvanUIStateContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';

import { useDashboardData } from '@/components/admin/dashboard/useDashboardData';

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
    isLoading, isFetching,
  } = useDashboardData(timePeriod);

  const firstName = teamMember?.name || 'Evan';

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
          <div className="lg:col-span-2 rounded-xl border bg-card p-8 flex items-center justify-center min-h-[300px]">
            <p className="text-muted-foreground text-sm">Actions Column — Prompt 2</p>
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
