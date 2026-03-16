import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';

interface RevenueGoalCardProps {
  personalRevenue: number;
  companyRevenue: number;
  goal: number;
  formatCurrency: (v: number) => string;
}

export const RevenueGoalCard = ({
  personalRevenue,
  companyRevenue,
  goal,
  formatCurrency,
}: RevenueGoalCardProps) => {
  const companyPct = Math.min(100, (companyRevenue / goal) * 100);
  const personalPct = Math.min(100, (personalRevenue / goal) * 100);

  // Simplified annualized forecast
  const now = new Date();
  const monthsElapsed = now.getMonth() + now.getDate() / 30;
  const annualizedPace = monthsElapsed > 0 ? (companyRevenue / monthsElapsed) * 12 : 0;
  const forecastPct = Math.min(99, Math.max(1, Math.round((annualizedPace / goal) * 100)));

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
      <CardContent className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-base font-bold">Road to $1.5M</h3>
          </div>
          <Badge variant="outline" className="text-xs font-semibold border-primary/20 text-primary">
            {companyPct.toFixed(0)}%
          </Badge>
        </div>

        {/* Progress bar — company total with personal overlay */}
        <div className="relative h-3 w-full rounded-full bg-muted/60 overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-primary/25 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${companyPct}%` }}
          />
          <div
            className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${personalPct}%` }}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-6 mt-4 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">You</p>
            <p className="text-sm font-bold text-primary">{formatCurrency(personalRevenue)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Company</p>
            <p className="text-sm font-bold">{formatCurrency(companyRevenue)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Goal</p>
            <p className="text-sm font-bold">$1.5M</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Forecast</p>
            <p className="text-sm font-bold">{formatCurrency(annualizedPace)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Confidence</p>
            <p className={`text-sm font-bold ${forecastPct >= 65 ? 'text-emerald-600 dark:text-emerald-400' : forecastPct >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
              {forecastPct}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
