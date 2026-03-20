import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import { DbTableBadge } from '@/components/admin/DbTableBadge';
import type { TimePeriod } from '@/pages/admin/Dashboard';
import type { ConfidenceData } from '@/components/admin/dashboard/useDashboardData';

interface RevenueGoalCardProps {
  timePeriod: TimePeriod;
  personalRevenue: number;
  companyRevenue: number;
  goal: number;
  confidence: ConfidenceData;
  formatCurrency: (v: number) => string;
}

export const RevenueGoalCard = ({
  timePeriod,
  personalRevenue,
  companyRevenue,
  goal,
  confidence,
  formatCurrency,
}: RevenueGoalCardProps) => {
  const periodGoal = timePeriod === 'mtd' ? goal / 12 : goal;

  const companyPct = Math.min(100, (companyRevenue / periodGoal) * 100);
  const personalPct = Math.min(100, (personalRevenue / periodGoal) * 100);

  return (
    <div className="p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            <Target className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </div>
          <h3 className="text-base font-bold">
            {timePeriod === 'mtd' ? `Road to ${formatCurrency(periodGoal)}` : 'Road to $1.5M'}
          </h3>
          <DbTableBadge tables={['leads']} />
        </div>
        <Badge variant="outline" className="text-xs font-semibold border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
          {companyPct.toFixed(0)}%
        </Badge>
      </div>

      {/* Progress bar — company total with personal overlay */}
      <div className="relative h-3 w-full rounded-full bg-muted/60 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-emerald-200 dark:bg-emerald-900 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${companyPct}%` }}
        />
        <div
          className="absolute left-0 top-0 h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${personalPct}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-6 mt-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">You</p>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(personalRevenue)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Company</p>
          <p className="text-sm font-bold">{formatCurrency(companyRevenue)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Goal</p>
          <p className="text-sm font-bold">{formatCurrency(periodGoal)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Forecast</p>
          <p className="text-sm font-bold">{formatCurrency(confidence.forecast)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Confidence</p>
          <p className={`text-sm font-bold ${confidence.score >= 65 ? 'text-emerald-600 dark:text-emerald-400' : confidence.score >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
            {confidence.score}%
          </p>
        </div>
      </div>
    </div>
  );
};
