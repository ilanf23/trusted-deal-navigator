import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, Users, User, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTeamMember } from '@/hooks/useTeamMember';
import { supabase } from '@/integrations/supabase/client';
import type { TimePeriod } from '@/pages/admin/Dashboard';

interface RoadTo1Point5MProps {
  evanId?: string;
  timePeriod?: TimePeriod;
}

export const RoadTo1Point5M = ({ evanId, timePeriod = 'ytd' }: RoadTo1Point5MProps) => {
  const { teamMember } = useTeamMember();
  const currentName = teamMember?.name || '';
  const COMPANY_GOAL = 1500000; // $1.5M

  const { data: teamDeals = [], isLoading } = useQuery({
    queryKey: ['team-funded-deals', timePeriod],
    queryFn: async () => {
      const startDate = timePeriod === 'ytd'
        ? new Date(new Date().getFullYear(), 0, 1).toISOString()
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      
      const { data } = await supabase
        .from('team_funded_deals')
        .select('loan_amount, fee_earned, days_in_pipeline, funded_at, team_member:users(name)')
        .gte('funded_at', startDate)
        .order('funded_at', { ascending: false });
      return (data || []).map((d: any) => ({
        rep: d.team_member?.name || 'Unknown',
        loanAmount: Number(d.loan_amount),
        daysInPipeline: d.days_in_pipeline,
        fee: Number(d.fee_earned),
      }));
    },
  });

  // Calculate totals
  const totalCompanyRevenue = teamDeals.reduce((sum, deal) => sum + deal.fee, 0);
  const myDeals = teamDeals.filter(d => d.rep === currentName);
  const evanRevenue = myDeals.reduce((sum, deal) => sum + deal.fee, 0);
  
  const companyProgress = Math.min(100, (totalCompanyRevenue / COMPANY_GOAL) * 100);
  const evanContribution = totalCompanyRevenue > 0 ? (evanRevenue / totalCompanyRevenue) * 100 : 0;
  const evanProgressOfGoal = (evanRevenue / COMPANY_GOAL) * 100;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const remaining = Math.max(0, COMPANY_GOAL - totalCompanyRevenue);

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 via-background to-primary/10 border-primary/20">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-background to-primary/10 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Road to $1.5M
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {timePeriod === 'ytd' ? 'Year to Date' : 'Month to Date'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Progress Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Company Total</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold">{formatCurrency(totalCompanyRevenue)}</span>
              <span className="text-muted-foreground text-sm"> / {formatCurrency(COMPANY_GOAL)}</span>
            </div>
          </div>
          
          {/* Stacked Progress showing Evan's contribution */}
          <div className="relative h-4 w-full rounded-full bg-muted overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-primary/30 rounded-full transition-all duration-500"
              style={{ width: `${companyProgress}%` }}
            />
            <div 
              className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${evanProgressOfGoal}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {companyProgress.toFixed(1)}% of goal reached
            </span>
            <span className="text-muted-foreground">
              {formatCurrency(remaining)} to go
            </span>
          </div>
        </div>

        {/* Evan's Contribution Section */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium">{currentName ? `${currentName}'s Contribution` : 'My Contribution'}</span>
            </div>
            <div className="flex items-center gap-1 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">{evanContribution.toFixed(1)}% of total</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{formatCurrency(evanRevenue)}</p>
              <p className="text-xs text-muted-foreground">Revenue Generated</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{myDeals.length}</p>
              <p className="text-xs text-muted-foreground">Deals Closed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{formatCurrency(evanRevenue / Math.max(1, myDeals.length))}</p>
              <p className="text-xs text-muted-foreground">Avg Deal Size</p>
            </div>
          </div>
        </div>

        {/* Recent Deals Table */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Recent Funded Deals</p>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Rep</th>
                  <th className="text-right p-2 font-medium">Loan Amount</th>
                  <th className="text-right p-2 font-medium">Days</th>
                  <th className="text-right p-2 font-medium">Fee Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {teamDeals.slice(0, 6).map((deal, idx) => (
                  <tr 
                    key={idx} 
                    className={deal.rep === currentName ? 'bg-primary/5' : ''}
                  >
                    <td className="p-2">
                      <span className={deal.rep === currentName ? 'font-medium text-primary' : ''}>
                        {deal.rep}
                      </span>
                    </td>
                    <td className="p-2 text-right">{formatCurrency(deal.loanAmount)}</td>
                    <td className="p-2 text-right text-muted-foreground">{deal.daysInPipeline}d</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(deal.fee)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30">
                <tr>
                  <td colSpan={3} className="p-2 font-medium text-right">Total</td>
                  <td className="p-2 text-right font-bold">{formatCurrency(totalCompanyRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
