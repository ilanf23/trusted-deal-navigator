import type { TimePeriod } from '@/pages/admin/Dashboard';

interface RevenueKPIStripProps {
  timePeriod: TimePeriod;
  mtdRevenue: number;
  ytdRevenue: number;
  pipelineValue: number;
  pipelineDeals: number;
  totalDeals: number;
  winRate: number;
  formatCurrency: (v: number) => string;
}

export const RevenueKPIStrip = ({
  timePeriod,
  mtdRevenue,
  ytdRevenue,
  pipelineValue,
  pipelineDeals,
  totalDeals,
  winRate,
  formatCurrency,
}: RevenueKPIStripProps) => {
  const revenue = timePeriod === 'mtd' ? mtdRevenue : ytdRevenue;
  const revenueLabel = timePeriod === 'mtd' ? 'MTD Revenue' : 'YTD Revenue';
  const revenueSub = timePeriod === 'mtd' ? 'month to date' : 'year to date';

  const metrics = [
    {
      label: revenueLabel,
      value: formatCurrency(revenue),
      sub: revenueSub,
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Pipeline',
      value: formatCurrency(pipelineValue),
      sub: `${pipelineDeals} active deals`,
      color: 'text-orange-600 dark:text-orange-400',
    },
    {
      label: 'Deals Closed',
      value: String(totalDeals),
      sub: 'funded deals',
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Win Rate',
      value: `${winRate}%`,
      sub: 'lead conversion',
      color: winRate >= 30 ? 'text-green-600 dark:text-green-400' : 'text-red-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4">
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className={`p-4 ${i > 0 ? 'border-l' : ''}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {m.label}
          </p>
          <p className={`text-2xl md:text-3xl font-extrabold tracking-tight mt-1 ${m.color}`}>
            {m.value}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
        </div>
      ))}
    </div>
  );
};
