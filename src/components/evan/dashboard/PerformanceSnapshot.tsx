import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Target, DollarSign, Gauge, BarChart3 } from 'lucide-react';
import { startOfYear, differenceInDays, startOfMonth } from 'date-fns';

interface PerformanceSnapshotProps {
  evanId?: string;
}

export const PerformanceSnapshot = ({ evanId }: PerformanceSnapshotProps) => {
  const today = new Date();
  const yearStart = startOfYear(today);
  const daysIntoYear = differenceInDays(today, yearStart);
  const yearProgress = Math.round((daysIntoYear / 365) * 100);

  const { data: metrics } = useQuery({
    queryKey: ['evan-performance-snapshot', evanId],
    queryFn: async () => {
      if (!evanId) return null;

      // Get Evan's funded leads this year
      const { data: fundedLeads } = await supabase
        .from('leads')
        .select('*')
        .eq('assigned_to', evanId)
        .eq('status', 'funded')
        .gte('converted_at', yearStart.toISOString());

      // Get all Evan's leads for pipeline value
      const { data: allLeads } = await supabase
        .from('leads')
        .select('*, lead_responses(*)')
        .eq('assigned_to', evanId);

      // Calculate metrics based on lead responses (loan amounts)
      let revenueYTD = 0;
      let weightedForecast = 0;
      
      const stageWeights: Record<string, number> = {
        discovery: 0.1,
        pre_qualification: 0.25,
        document_collection: 0.5,
        underwriting: 0.7,
        approval: 0.9,
        funded: 1.0,
      };

      fundedLeads?.forEach(lead => {
        // Estimate fee at 2% of loan amount or flat $5000 if no amount
        const loanAmount = (lead as any).lead_responses?.[0]?.loan_amount || 250000;
        revenueYTD += loanAmount * 0.02;
      });

      allLeads?.forEach(lead => {
        if (lead.status !== 'funded') {
          const loanAmount = (lead as any).lead_responses?.[0]?.loan_amount || 250000;
          const fee = loanAmount * 0.02;
          const weight = stageWeights[lead.status] || 0.1;
          weightedForecast += fee * weight;
        }
      });

      const annualTarget = 500000; // $500k annual target
      const targetToDate = (annualTarget * yearProgress) / 100;
      const paceVsPlan = targetToDate > 0 ? Math.round((revenueYTD / targetToDate) * 100) : 0;
      
      // Confidence score based on pipeline health
      const pipelineLeads = allLeads?.filter(l => l.status !== 'funded').length || 0;
      const advancedStageLeads = allLeads?.filter(l => 
        ['underwriting', 'approval'].includes(l.status)
      ).length || 0;
      const confidenceScore = Math.min(100, Math.round(
        (pipelineLeads * 5) + (advancedStageLeads * 15) + (paceVsPlan * 0.3)
      ));

      return {
        revenueYTD,
        annualTarget,
        targetToDate,
        paceVsPlan,
        weightedForecast,
        confidenceScore,
        fundedDeals: fundedLeads?.length || 0,
      };
    },
    enabled: !!evanId,
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const paceStatus = (metrics?.paceVsPlan || 0) >= 100 ? 'ahead' : 'behind';

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          Performance Snapshot
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Revenue YTD */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Revenue YTD</span>
            </div>
            <p className="text-2xl font-bold text-emerald-500">
              {formatCurrency(metrics?.revenueYTD || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.fundedDeals || 0} deals funded
            </p>
          </div>

          {/* Target vs Actual */}
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Target Progress</span>
            </div>
            <p className="text-2xl font-bold text-blue-500">
              {Math.round(((metrics?.revenueYTD || 0) / (metrics?.annualTarget || 1)) * 100)}%
            </p>
            <Progress 
              value={((metrics?.revenueYTD || 0) / (metrics?.annualTarget || 1)) * 100} 
              className="h-1.5 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              of {formatCurrency(metrics?.annualTarget || 0)}
            </p>
          </div>

          {/* Pace vs Plan */}
          <div className={`p-4 rounded-xl ${
            paceStatus === 'ahead' 
              ? 'bg-green-500/10 border border-green-500/20' 
              : 'bg-amber-500/10 border border-amber-500/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {paceStatus === 'ahead' ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-xs text-muted-foreground">Pace vs Plan</span>
            </div>
            <p className={`text-2xl font-bold ${
              paceStatus === 'ahead' ? 'text-green-500' : 'text-amber-500'
            }`}>
              {metrics?.paceVsPlan || 0}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {paceStatus === 'ahead' ? 'Ahead of pace' : 'Behind pace'}
            </p>
          </div>

          {/* Weighted Forecast */}
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Weighted Forecast</span>
            </div>
            <p className="text-2xl font-bold text-purple-500">
              {formatCurrency(metrics?.weightedForecast || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Pipeline value
            </p>
          </div>

          {/* Confidence Score */}
          <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="h-4 w-4 text-cyan-500" />
              <span className="text-xs text-muted-foreground">Confidence</span>
            </div>
            <p className="text-2xl font-bold text-cyan-500">
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
