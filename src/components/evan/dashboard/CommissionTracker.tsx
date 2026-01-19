import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DollarSign, TrendingUp, Clock, Target } from 'lucide-react';
import { startOfMonth, endOfMonth, startOfYear } from 'date-fns';

interface CommissionTrackerProps {
  evanId?: string;
}

export const CommissionTracker = ({ evanId }: CommissionTrackerProps) => {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const yearStart = startOfYear(today);

  const { data: commission } = useQuery({
    queryKey: ['evan-commission-tracker', evanId],
    queryFn: async () => {
      if (!evanId) return null;

      // Get funded deals this month
      const { data: monthlyFunded } = await supabase
        .from('leads')
        .select('*, lead_responses(*)')
        .eq('assigned_to', evanId)
        .eq('status', 'funded')
        .gte('converted_at', monthStart.toISOString());

      // Get funded deals this year
      const { data: yearlyFunded } = await supabase
        .from('leads')
        .select('*, lead_responses(*)')
        .eq('assigned_to', evanId)
        .eq('status', 'funded')
        .gte('converted_at', yearStart.toISOString());

      // Get pending (in approval stage)
      const { data: pendingDeals } = await supabase
        .from('leads')
        .select('*, lead_responses(*)')
        .eq('assigned_to', evanId)
        .eq('status', 'approval');

      // Calculate commissions (assume 2% fee, 25% commission split)
      const calculateCommission = (leads: any[]) => {
        return leads.reduce((sum, lead) => {
          const loanAmount = lead.lead_responses?.[0]?.loan_amount || 250000;
          const fee = loanAmount * 0.02;
          const commission = fee * 0.25;
          return sum + commission;
        }, 0);
      };

      const monthlyEarned = calculateCommission(monthlyFunded || []);
      const yearlyEarned = calculateCommission(yearlyFunded || []);
      const pendingCommission = calculateCommission(pendingDeals || []);

      const monthlyGoal = 10000; // $10k monthly goal
      const progressPercent = Math.min(100, Math.round((monthlyEarned / monthlyGoal) * 100));

      return {
        monthlyEarned,
        yearlyEarned,
        pendingCommission,
        monthlyGoal,
        progressPercent,
        dealsThisMonth: monthlyFunded?.length || 0,
        pendingDeals: pendingDeals?.length || 0,
      };
    },
    enabled: !!evanId,
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <Card className="bg-gradient-to-br from-emerald-500/5 to-card border-emerald-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5 text-emerald-500" />
          Commission Tracker
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Monthly Earned */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">This Month</span>
            </div>
            <p className="text-xl font-bold text-emerald-500">
              {formatCurrency(commission?.monthlyEarned || 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {commission?.dealsThisMonth || 0} deals
            </p>
          </div>

          {/* Pending */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <p className="text-xl font-bold text-amber-500">
              {formatCurrency(commission?.pendingCommission || 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {commission?.pendingDeals || 0} in approval
            </p>
          </div>

          {/* YTD */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Year to Date</span>
            </div>
            <p className="text-xl font-bold text-blue-500">
              {formatCurrency(commission?.yearlyEarned || 0)}
            </p>
            <p className="text-xs text-muted-foreground">Total earned</p>
          </div>
        </div>

        {/* Monthly Goal Progress */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Monthly Goal</span>
            </div>
            <span className="text-sm font-bold text-primary">
              {commission?.progressPercent || 0}%
            </span>
          </div>
          <Progress value={commission?.progressPercent || 0} className="h-2 mb-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(commission?.monthlyEarned || 0)}</span>
            <span>{formatCurrency(commission?.monthlyGoal || 0)} goal</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
