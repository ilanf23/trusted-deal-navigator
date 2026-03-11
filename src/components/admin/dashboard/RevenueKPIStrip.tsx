import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Target, Activity, Briefcase } from 'lucide-react';

interface RevenueKPIStripProps {
  companyRevenue: number;
  companyGoalPct: number;
  totalRevenue: number;
  totalDeals: number;
  avgDealSize: number;
  pipelineValue: number;
  pipelineDeals: number;
  winRate: number;
  formatCurrency: (v: number) => string;
}

const ANNUAL_GOAL = 1500000;

export const RevenueKPIStrip = ({
  companyRevenue,
  companyGoalPct,
  totalRevenue,
  totalDeals,
  avgDealSize,
  pipelineValue,
  pipelineDeals,
  winRate,
  formatCurrency,
}: RevenueKPIStripProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
      {/* Road to $1.5M */}
      <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background hover:border-primary/40 hover:shadow-[0_4px_14px_-3px_hsl(217_91%_50%/0.15)] transition-all duration-200">
        <CardContent className="pt-4 md:pt-5 px-3 md:px-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Target className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Road to $1.5M
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/20 text-primary font-semibold">
              {companyGoalPct.toFixed(0)}%
            </Badge>
          </div>
          <p className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground">
            {formatCurrency(companyRevenue)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">company total</p>
          <div className="relative h-2.5 w-full rounded-full bg-muted/60 mt-3 overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-primary/25 transition-all duration-700 ease-out"
              style={{ width: `${companyGoalPct}%` }}
            />
            <div
              className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, (totalRevenue / ANNUAL_GOAL) * 100)}%` }}
            />
          </div>
          <div className="flex items-center divide-x divide-border mt-2.5 text-[10px]">
            <div className="pr-2">
              <span className="text-muted-foreground">You</span>
              <span className="ml-1 font-semibold text-primary">{formatCurrency(totalRevenue)}</span>
            </div>
            <div className="pl-2">
              <span className="text-muted-foreground">Goal</span>
              <span className="ml-1 font-semibold text-foreground">$1.5M</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deals Closed */}
      <Card className="border hover:border-emerald-500/30 hover:shadow-[0_4px_14px_-3px_hsl(142_50%_45%/0.12)] transition-all duration-200">
        <CardContent className="pt-4 md:pt-5 px-3 md:px-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Deals Closed
            </p>
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <Briefcase className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground">
            {totalDeals}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">funded deals</p>
          <div className="mt-3 pt-2.5 border-t border-border/60">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Avg size</p>
            <p className="text-sm font-bold text-foreground mt-0.5">{formatCurrency(avgDealSize)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline */}
      <Card className="border hover:border-orange-500/30 hover:shadow-[0_4px_14px_-3px_hsl(25_95%_53%/0.12)] transition-all duration-200">
        <CardContent className="pt-4 md:pt-5 px-3 md:px-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Pipeline
            </p>
            <div className="p-1.5 rounded-lg bg-orange-500/10">
              <Target className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground">
            {formatCurrency(pipelineValue)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">weighted potential</p>
          <div className="mt-3 pt-2.5 border-t border-border/60">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Active deals</p>
            <p className="text-sm font-bold text-foreground mt-0.5">{pipelineDeals}</p>
          </div>
        </CardContent>
      </Card>

      {/* Win Rate */}
      <Card className={`border transition-all duration-200 ${
        winRate >= 30
          ? 'hover:border-green-500/30 hover:shadow-[0_4px_14px_-3px_hsl(142_50%_45%/0.12)]'
          : 'hover:border-red-400/30 hover:shadow-[0_4px_14px_-3px_hsl(0_72%_51%/0.12)]'
      }`}>
        <CardContent className="pt-4 md:pt-5 px-3 md:px-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Win Rate
            </p>
            <div className={`p-1.5 rounded-lg ${
              winRate >= 30 ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              <Activity className={`h-3.5 w-3.5 ${
                winRate >= 30 ? 'text-green-600 dark:text-green-400' : 'text-red-500'
              }`} />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground">
            {winRate}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">lead conversion</p>
          <div className="mt-3 pt-2.5 border-t border-border/60">
            <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
              winRate >= 30
                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
            }`}>
              {winRate >= 30 ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5" />
              )}
              {winRate >= 30 ? 'Above target' : 'Below target'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
