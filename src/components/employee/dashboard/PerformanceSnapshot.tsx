import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Target, DollarSign, Gauge, BarChart3, Loader2 } from 'lucide-react';
import { startOfYear, startOfMonth, differenceInDays } from 'date-fns';
import type { TimePeriod } from '@/pages/admin/Dashboard';

interface PerformanceSnapshotProps {
  evanId?: string;
  timePeriod?: TimePeriod;
}

const stageWeights: Record<string, number> = {
  discovery: 0.1,
  initial_review: 0.15,
  pre_qualification: 0.25,
  onboarding: 0.3,
  document_collection: 0.5,
  moving_to_underwriting: 0.6,
  underwriting: 0.7,
  ready_for_wu_approval: 0.8,
  pre_approval_issued: 0.85,
  approval: 0.9,
};

const annualTarget = 500000;
const monthlyTarget = 45000;

export const PerformanceSnapshot = ({ evanId, timePeriod = 'ytd' }: PerformanceSnapshotProps) => {
  const today = new Date();
  const yearStart = startOfYear(today);
  const monthStart = startOfMonth(today);
  const periodStart = timePeriod === 'ytd' ? yearStart : monthStart;

  const daysIntoPeriod = differenceInDays(today, periodStart);
  const totalDaysInPeriod = timePeriod === 'ytd' ? 365 : new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const periodProgress = Math.round((daysIntoPeriod / totalDaysInPeriod) * 100);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['performance-snapshot', evanId, timePeriod],
    queryFn: async () => {
      const startDate = periodStart.toISOString();

      // Fetch funded deals from pipeline (won deals)
      const { data: fundedDeals } = await supabase
        .from('pipeline')
        .select('actual_net_revenue, net_revenue, close_date')
        .eq('won', true)
        .gte('close_date', startDate);

      // Fetch pipeline deals (not funded/won/lost)
      const { data: pipelineDeals } = await supabase
        .from('pipeline')
        .select('deal_value, status')
        .not('status', 'in', '("funded","won","lost")');

      const funded = fundedDeals || [];
      const pipeline = pipelineDeals || [];

      const revenueInPeriod = funded.reduce((sum, d) => sum + (Number(d.actual_net_revenue) || Number(d.net_revenue) || 0), 0);
      const fundedCount = funded.length;

      const weightedForecast = pipeline.reduce((sum, d) => {
        const dealValue = Number(d.deal_value) || 0;
        const fee = dealValue * 0.01;
        const weight = stageWeights[d.status] || 0.1;
        return sum + (fee * weight);
      }, 0);

      const targetAmount = timePeriod === 'ytd' ? annualTarget : monthlyTarget;
      const targetToDate = (targetAmount * periodProgress) / 100;
      const paceVsPlan = targetToDate > 0 ? Math.round((revenueInPeriod / targetToDate) * 100) : 0;

      const advancedStageDeals = pipeline.filter(d =>
        ['underwriting', 'ready_for_wu_approval', 'pre_approval_issued', 'approval'].includes(d.status)
      ).length;
      const confidenceScore = Math.min(100, Math.round(
        (pipeline.length * 5) + (advancedStageDeals * 15) + (paceVsPlan * 0.3)
      ));

      return {
        revenueInPeriod,
        targetAmount,
        targetToDate,
        paceVsPlan,
        weightedForecast,
        confidenceScore,
        fundedDeals: fundedCount,
        periodProgress,
      };
    },
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const paceStatus = (metrics?.paceVsPlan || 0) >= 100 ? 'ahead' : 'behind';
  const periodLabel = timePeriod === 'ytd' ? 'YTD' : 'MTD';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

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
