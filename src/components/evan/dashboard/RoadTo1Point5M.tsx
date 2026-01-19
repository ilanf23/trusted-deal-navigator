import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, Users, User } from 'lucide-react';
import type { TimePeriod } from '@/pages/admin/EvansPage';

interface RoadTo1Point5MProps {
  evanId?: string;
  timePeriod?: TimePeriod;
}

// Mock data for team deals
const mockTeamDeals = [
  { rep: 'Evan', loanAmount: 850000, daysInPipeline: 12, fee: 17000 },
  { rep: 'Evan', loanAmount: 425000, daysInPipeline: 8, fee: 8500 },
  { rep: 'Evan', loanAmount: 1200000, daysInPipeline: 22, fee: 24000 },
  { rep: 'Evan', loanAmount: 275000, daysInPipeline: 5, fee: 5500 },
  { rep: 'Brad', loanAmount: 650000, daysInPipeline: 15, fee: 13000 },
  { rep: 'Brad', loanAmount: 320000, daysInPipeline: 10, fee: 6400 },
  { rep: 'Wendy', loanAmount: 890000, daysInPipeline: 18, fee: 17800 },
  { rep: 'Wendy', loanAmount: 450000, daysInPipeline: 7, fee: 9000 },
  { rep: 'Adam', loanAmount: 780000, daysInPipeline: 14, fee: 15600 },
];

export const RoadTo1Point5M = ({ evanId, timePeriod = 'ytd' }: RoadTo1Point5MProps) => {
  const COMPANY_GOAL = 1500000; // $1.5M

  // Calculate totals
  const totalCompanyRevenue = mockTeamDeals.reduce((sum, deal) => sum + deal.fee, 0);
  const evanDeals = mockTeamDeals.filter(d => d.rep === 'Evan');
  const evanRevenue = evanDeals.reduce((sum, deal) => sum + deal.fee, 0);
  
  const companyProgress = Math.min(100, (totalCompanyRevenue / COMPANY_GOAL) * 100);
  const evanContribution = (evanRevenue / totalCompanyRevenue) * 100;
  const evanProgressOfGoal = (evanRevenue / COMPANY_GOAL) * 100;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const remaining = Math.max(0, COMPANY_GOAL - totalCompanyRevenue);

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
            {/* Full company progress background */}
            <div 
              className="absolute left-0 top-0 h-full bg-primary/30 rounded-full transition-all duration-500"
              style={{ width: `${companyProgress}%` }}
            />
            {/* Evan's contribution highlighted */}
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
              <span className="font-medium">Evan's Contribution</span>
            </div>
            <div className="flex items-center gap-1 text-green-600">
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
              <p className="text-2xl font-bold">{evanDeals.length}</p>
              <p className="text-xs text-muted-foreground">Deals Closed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{formatCurrency(evanRevenue / Math.max(1, evanDeals.length))}</p>
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
                {mockTeamDeals.slice(0, 6).map((deal, idx) => (
                  <tr 
                    key={idx} 
                    className={deal.rep === 'Evan' ? 'bg-primary/5' : ''}
                  >
                    <td className="p-2">
                      <span className={deal.rep === 'Evan' ? 'font-medium text-primary' : ''}>
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