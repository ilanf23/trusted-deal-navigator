import { useState, useMemo, useCallback } from 'react';
import EvanLayout from '@/components/evan/EvanLayout';
import { useEvanUIState } from '@/contexts/EvanUIStateContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Loader2 } from 'lucide-react';

import { useDashboardData } from '@/components/admin/dashboard/useDashboardData';
import { DashboardHeader } from '@/components/admin/dashboard/DashboardHeader';
import { RevenueKPIStrip } from '@/components/admin/dashboard/RevenueKPIStrip';
import { RevenueGoalCard } from '@/components/admin/dashboard/RevenueGoalCard';
import { DealSourcesChart } from '@/components/admin/dashboard/DealSourcesChart';
import { CommissionSection } from '@/components/admin/dashboard/CommissionSection';
import { NewSignupsWidget } from '@/components/admin/dashboard/NewSignupsWidget';
import { PipelineHealthWidget } from '@/components/admin/dashboard/PipelineHealthWidget';
import { CallsActivityWidget } from '@/components/admin/dashboard/CallsActivityWidget';
import { TasksOverviewWidget } from '@/components/admin/dashboard/TasksOverviewWidget';
import { ScorecardMiniWidget } from '@/components/admin/dashboard/ScorecardMiniWidget';
import { LenderProgramsWidget } from '@/components/admin/dashboard/LenderProgramsWidget';

import { TopActions } from '@/components/evan/dashboard/TopActions';
import { NudgesWidget } from '@/components/evan/dashboard/NudgesWidget';
import { CompanyRevenueHero } from '@/components/evan/dashboard/CompanyRevenueHero';
import { ActivityFeed } from '@/components/evan/dashboard/ActivityFeed';

export type TimePeriod = 'mtd' | 'ytd' | 'qtd';

const ANNUAL_GOAL = 1500000;

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
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
  const [chartPeriod, setChartPeriodLocal] = useState<TimePeriod>(persisted.chartPeriod);
  const [calcLoanAmount, setCalcLoanAmountLocal] = useState<string>(persisted.calcLoanAmount);
  const [calcExtraDeals, setCalcExtraDealsLocal] = useState<string>(persisted.calcExtraDeals);

  const setTimePeriod = useCallback((v: TimePeriod) => { setTimePeriodLocal(v); setChartPeriodLocal(v); setPageState('dashboard', { timePeriod: v, chartPeriod: v }); }, [setPageState]);
  const setChartPeriod = useCallback((v: TimePeriod) => { setChartPeriodLocal(v); setPageState('dashboard', { chartPeriod: v }); }, [setPageState]);
  const setCalcLoanAmount = useCallback((v: string) => { setCalcLoanAmountLocal(v); setPageState('dashboard', { calcLoanAmount: v }); }, [setPageState]);
  const setCalcExtraDeals = useCallback((v: string) => { setCalcExtraDealsLocal(v); setPageState('dashboard', { calcExtraDeals: v }); }, [setPageState]);

  const {
    leadsData, pipelineData, fundedLeads,
    companyRevenueYTD, companyRevenueMTD, confidence,
    touchpointsData, tasksData, scorecardData, lenderData,
    isLoading, isFetching,
    callsLoading, tasksLoading, scorecardLoading, lenderLoading,
  } = useDashboardData(timePeriod);

  const evanId = teamMember?.id;
  const firstName = teamMember?.name || 'there';

  // Metrics derived from leads/pipeline/funded data
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

    return { totalRevenue, totalDeals, avgDealSize, pipelineValue, pipelineDeals, winRate };
  }, [leadsData, pipelineData, fundedLeads]);


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

  return (
    <EvanLayout>
      <div className="space-y-4 md:space-y-6">
        {/* 1. Header — greeting, date, time period selector */}
        <DashboardHeader
          firstName={firstName}
          timePeriod={timePeriod}
          setTimePeriod={setTimePeriod}
          isFetching={isFetching}
        />

        {/* 2. Road to $1.5M + KPI Strip — unified hero card */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <RevenueGoalCard
            timePeriod={timePeriod}
            personalRevenue={metrics.totalRevenue}
            companyRevenue={timePeriod === 'mtd' ? companyRevenueMTD : companyRevenueYTD}
            goal={ANNUAL_GOAL}
            confidence={confidence}
            formatCurrency={formatCurrency}
          />
          <div className="border-t">
            <RevenueKPIStrip
              timePeriod={timePeriod}
              mtdRevenue={companyRevenueMTD}
              ytdRevenue={companyRevenueYTD}
              pipelineValue={metrics.pipelineValue}
              pipelineDeals={metrics.pipelineDeals}
              totalDeals={metrics.totalDeals}
              winRate={metrics.winRate}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>

        {/* 4. Revenue Analytics */}
        <CompanyRevenueHero chartPeriod={chartPeriod} setChartPeriod={setChartPeriod} confidence={confidence} />

        {/* 5. Top 10 Actions — the core of the OS */}
        <TopActions evanId={evanId} />

        {/* 7. Nudges — conditional follow-up reminders */}
        <NudgesWidget evanId={evanId} />

        {/* 8. Pipeline Health + Weekly Scorecard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <PipelineHealthWidget pipelineData={pipelineData} formatCurrency={formatCurrency} />
          <ScorecardMiniWidget scorecardData={scorecardData} isLoading={scorecardLoading} />
        </div>

        {/* 9. Tasks Overview + Calls Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <TasksOverviewWidget tasksData={tasksData} isLoading={tasksLoading} />
          <CallsActivityWidget callsData={touchpointsData} isLoading={callsLoading} />
        </div>

        {/* 10. Activity Feed — audit log */}
        <ActivityFeed evanId={evanId} />

        {/* 11. Tools & Resources */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-4">
            Tools & Resources
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <DealSourcesChart leadsData={leadsData} />
            <LenderProgramsWidget lenderData={lenderData} isLoading={lenderLoading} />
            <NewSignupsWidget />
          </div>
        </div>

        {/* 12. Commission Calculator */}
        <CommissionSection
          calcLoanAmount={calcLoanAmount}
          setCalcLoanAmount={setCalcLoanAmount}
          calcExtraDeals={calcExtraDeals}
          setCalcExtraDeals={setCalcExtraDeals}
        />
      </div>
    </EvanLayout>
  );
};

export default Dashboard;
