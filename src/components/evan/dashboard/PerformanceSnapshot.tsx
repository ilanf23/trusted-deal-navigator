import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Target, DollarSign, Gauge, BarChart3 } from 'lucide-react';
import { startOfYear, startOfMonth, differenceInDays } from 'date-fns';
import type { TimePeriod } from '@/pages/admin/Dashboard';

interface PerformanceSnapshotProps {
  evanId?: string;
  timePeriod?: TimePeriod;
}

// Mock data for varied deal values (simulating different closing prices)
const mockDealData = [
  { status: 'funded', loanAmount: 850000, closedDate: '2026-01-05' },
  { status: 'funded', loanAmount: 425000, closedDate: '2026-01-08' },
  { status: 'funded', loanAmount: 1200000, closedDate: '2025-12-15' },
  { status: 'funded', loanAmount: 275000, closedDate: '2025-11-20' },
  { status: 'funded', loanAmount: 950000, closedDate: '2025-10-10' },
  { status: 'funded', loanAmount: 180000, closedDate: '2025-09-25' },
  { status: 'funded', loanAmount: 2100000, closedDate: '2025-08-18' },
  { status: 'funded', loanAmount: 650000, closedDate: '2025-07-05' },
  { status: 'funded', loanAmount: 520000, closedDate: '2025-06-12' },
  { status: 'funded', loanAmount: 380000, closedDate: '2025-05-22' },
  { status: 'funded', loanAmount: 1450000, closedDate: '2025-04-08' },
  { status: 'funded', loanAmount: 290000, closedDate: '2025-03-15' },
  { status: 'funded', loanAmount: 780000, closedDate: '2025-02-28' },
  { status: 'funded', loanAmount: 1100000, closedDate: '2025-01-18' },
  // Pipeline deals (not funded yet)
  { status: 'discovery', loanAmount: 450000 },
  { status: 'pre_qualification', loanAmount: 890000 },
  { status: 'pre_qualification', loanAmount: 320000 },
  { status: 'document_collection', loanAmount: 1750000 },
  { status: 'document_collection', loanAmount: 560000 },
  { status: 'underwriting', loanAmount: 980000 },
  { status: 'underwriting', loanAmount: 1200000 },
  { status: 'approval', loanAmount: 720000 },
  { status: 'approval', loanAmount: 2400000 },
];

export const PerformanceSnapshot = ({ evanId, timePeriod = 'ytd' }: PerformanceSnapshotProps) => {
  const today = new Date();
  const yearStart = startOfYear(today);
  const monthStart = startOfMonth(today);
  const periodStart = timePeriod === 'ytd' ? yearStart : monthStart;
  
  const daysIntoPeriod = differenceInDays(today, periodStart);
  const totalDaysInPeriod = timePeriod === 'ytd' ? 365 : new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const periodProgress = Math.round((daysIntoPeriod / totalDaysInPeriod) * 100);

  const { data: metrics } = useQuery({
    queryKey: ['evan-performance-snapshot', evanId, timePeriod],
    queryFn: async () => {
      // Calculate metrics from mock data based on time period
      const stageWeights: Record<string, number> = {
        discovery: 0.1,
        pre_qualification: 0.25,
        document_collection: 0.5,
        underwriting: 0.7,
        approval: 0.9,
        funded: 1.0,
      };

      // Filter funded deals by period
      const fundedDeals = mockDealData.filter(deal => {
        if (deal.status !== 'funded' || !deal.closedDate) return false;
        const closedDate = new Date(deal.closedDate);
        return closedDate >= periodStart && closedDate <= today;
      });

      // Calculate revenue (2% broker fee on loan amount)
      const revenueInPeriod = fundedDeals.reduce((sum, deal) => sum + (deal.loanAmount * 0.02), 0);
      
      // Pipeline deals (not funded)
      const pipelineDeals = mockDealData.filter(deal => deal.status !== 'funded');
      
      // Calculate weighted forecast
      const weightedForecast = pipelineDeals.reduce((sum, deal) => {
        const fee = deal.loanAmount * 0.02;
        const weight = stageWeights[deal.status] || 0.1;
        return sum + (fee * weight);
      }, 0);

      // Annual/Monthly targets
      const annualTarget = 500000;
      const monthlyTarget = 45000;
      const targetAmount = timePeriod === 'ytd' ? annualTarget : monthlyTarget;
      const targetToDate = (targetAmount * periodProgress) / 100;
      const paceVsPlan = targetToDate > 0 ? Math.round((revenueInPeriod / targetToDate) * 100) : 0;
      
      // Confidence score based on pipeline health
      const advancedStageDeals = pipelineDeals.filter(d => 
        ['underwriting', 'approval'].includes(d.status)
      ).length;
      const confidenceScore = Math.min(100, Math.round(
        (pipelineDeals.length * 5) + (advancedStageDeals * 15) + (paceVsPlan * 0.3)
      ));

      return {
        revenueInPeriod,
        targetAmount,
        targetToDate,
        paceVsPlan,
        weightedForecast,
        confidenceScore,
        fundedDeals: fundedDeals.length,
        periodProgress,
      };
    },
    enabled: true,
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const paceStatus = (metrics?.paceVsPlan || 0) >= 100 ? 'ahead' : 'behind';
  const periodLabel = timePeriod === 'ytd' ? 'YTD' : 'MTD';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          Performance Snapshot ({periodLabel})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Revenue in Period */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Revenue {periodLabel}</span>
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(metrics?.revenueInPeriod || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.fundedDeals || 0} deals funded
            </p>
          </div>

          {/* Target vs Actual */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Target Progress</span>
            </div>
            <p className="text-2xl font-bold">
              {Math.round(((metrics?.revenueInPeriod || 0) / (metrics?.targetAmount || 1)) * 100)}%
            </p>
            <Progress 
              value={((metrics?.revenueInPeriod || 0) / (metrics?.targetAmount || 1)) * 100} 
              className="h-1.5 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              of {formatCurrency(metrics?.targetAmount || 0)}
            </p>
          </div>

          {/* Pace vs Plan */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-2">
              {paceStatus === 'ahead' ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-xs text-muted-foreground">Pace vs Plan</span>
            </div>
            <p className={`text-2xl font-bold ${paceStatus === 'ahead' ? 'text-green-600' : 'text-amber-600'}`}>
              {metrics?.paceVsPlan || 0}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {paceStatus === 'ahead' ? 'Ahead of pace' : 'Behind pace'}
            </p>
          </div>

          {/* Weighted Forecast */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Weighted Forecast</span>
            </div>
            <p className="text-2xl font-bold">
              {formatCurrency(metrics?.weightedForecast || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Pipeline value
            </p>
          </div>

          {/* Confidence Score */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Confidence</span>
            </div>
            <p className="text-2xl font-bold">
              {metrics?.confidenceScore || 0}
            </p>
            <Progress 
              value={metrics?.confidenceScore || 0} 
              className="h-1.5 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Deal health score
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
