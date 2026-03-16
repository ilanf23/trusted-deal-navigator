interface RevenueKPIStripProps {
  mtdRevenue: number;
  ytdRevenue: number;
  pipelineValue: number;
  pipelineDeals: number;
  totalDeals: number;
  winRate: number;
  formatCurrency: (v: number) => string;
}

export const RevenueKPIStrip = ({
  mtdRevenue,
  ytdRevenue,
  pipelineValue,
  pipelineDeals,
  totalDeals,
  winRate,
  formatCurrency,
}: RevenueKPIStripProps) => {
  const metrics = [
    {
      label: 'MTD Revenue',
      value: formatCurrency(mtdRevenue),
      accent: 'border-l-blue-500',
    },
    {
      label: 'YTD Revenue',
      value: formatCurrency(ytdRevenue),
      accent: 'border-l-primary',
    },
    {
      label: 'Pipeline',
      value: formatCurrency(pipelineValue),
      sub: `${pipelineDeals} active deals`,
      accent: 'border-l-orange-500',
    },
    {
      label: 'Deals Closed',
      value: String(totalDeals),
      sub: 'funded deals',
      accent: 'border-l-emerald-500',
    },
    {
      label: 'Win Rate',
      value: `${winRate}%`,
      sub: 'lead conversion',
      accent: winRate >= 30 ? 'border-l-green-500' : 'border-l-red-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className={`p-4 rounded-xl border border-l-4 bg-card ${m.accent} hover:shadow-sm transition-shadow`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {m.label}
          </p>
          <p className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mt-1">
            {m.value}
          </p>
          {m.sub && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
};
