import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Activity, TrendingUp, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { startOfYear, startOfMonth, format, eachMonthOfInterval, eachDayOfInterval, endOfDay } from 'date-fns';
import type { TimePeriod } from '@/pages/admin/EvansPage';

interface CompanyRevenueHeroProps {
  chartPeriod: TimePeriod;
  setChartPeriod: (v: TimePeriod) => void;
}

export const CompanyRevenueHero = ({ chartPeriod, setChartPeriod }: CompanyRevenueHeroProps) => {
  const COMPANY_GOAL = 1500000;
  const now = new Date();

  const { data: teamDeals = [], isLoading } = useQuery({
    queryKey: ['company-revenue-hero', chartPeriod],
    queryFn: async () => {
      const startDate = startOfYear(now).toISOString();
      const { data } = await supabase
        .from('team_funded_deals')
        .select('rep_name, loan_amount, fee_earned, days_in_pipeline, funded_at')
        .gte('funded_at', startDate)
        .order('funded_at', { ascending: true });
      return (data || []).map((d: any) => ({
        rep: d.rep_name,
        loanAmount: Number(d.loan_amount),
        fee: Number(d.fee_earned),
        fundedAt: d.funded_at,
        daysInPipeline: d.days_in_pipeline,
      }));
    },
  });

  const { chartData, stats } = useMemo(() => {
    if (chartPeriod === 'ytd') {
      const months = eachMonthOfInterval({ start: startOfYear(now), end: now });
      let cumulative = 0;

      const data = months.map((month) => {
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        const monthDeals = teamDeals.filter((d) => {
          const date = new Date(d.fundedAt);
          return date >= month && date <= monthEnd;
        });
        const revenue = monthDeals.reduce((s, d) => s + d.fee, 0);
        cumulative += revenue;
        return { label: format(month, 'MMM'), revenue, cumulative, deals: monthDeals.length };
      });

      const totalRevenue = cumulative;
      const activeMonths = data.filter((d) => d.revenue > 0);
      const avgPerMonth = activeMonths.length > 0 ? totalRevenue / activeMonths.length : 0;
      const bestMonth = data.reduce((best, m) => (m.revenue > best.revenue ? m : best), { label: '-', revenue: 0 });
      const totalDeals = teamDeals.length;
      const avgDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;

      return {
        chartData: data,
        stats: {
          totalRevenue, goalProgress: Math.round((totalRevenue / COMPANY_GOAL) * 100),
          avgPerPoint: avgPerMonth, activePoints: activeMonths.length,
          bestLabel: bestMonth.label, bestValue: bestMonth.revenue,
          totalDeals, avgDealSize, pointLabel: 'months',
          avgLabel: 'Monthly Avg', bestPointLabel: 'Best Month', revenueLabel: 'YTD Revenue',
        },
      };
    } else {
      const monthStart = startOfMonth(now);
      const days = eachDayOfInterval({ start: monthStart, end: now });
      let cumulative = 0;
      const mtdDeals = teamDeals.filter((d) => new Date(d.fundedAt) >= monthStart);

      const data = days.map((day) => {
        const dayEnd = endOfDay(day);
        const dayDeals = mtdDeals.filter((d) => {
          const date = new Date(d.fundedAt);
          return date >= day && date <= dayEnd;
        });
        const revenue = dayDeals.reduce((s, d) => s + d.fee, 0);
        cumulative += revenue;
        return { label: format(day, 'd'), revenue, cumulative, deals: dayDeals.length };
      });

      const totalRevenue = cumulative;
      const activeDays = data.filter((d) => d.revenue > 0);
      const avgPerDay = activeDays.length > 0 ? totalRevenue / activeDays.length : 0;
      const bestDay = data.reduce((best, d) => (d.revenue > best.revenue ? d : best), { label: '-', revenue: 0 });
      const totalDeals = mtdDeals.length;
      const avgDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;
      const monthlyTarget = 125000;

      return {
        chartData: data,
        stats: {
          totalRevenue, goalProgress: Math.round((totalRevenue / monthlyTarget) * 100),
          avgPerPoint: avgPerDay, activePoints: activeDays.length,
          bestLabel: bestDay.label, bestValue: bestDay.revenue,
          totalDeals, avgDealSize, pointLabel: 'days',
          avgLabel: 'Daily Avg', bestPointLabel: 'Best Day', revenueLabel: 'MTD Revenue',
        },
      };
    }
  }, [teamDeals, chartPeriod, now]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatCurrencyFull = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const remaining = Math.max(0, COMPANY_GOAL - stats.totalRevenue);

  if (isLoading) {
    return (
      <Card className="border border-border bg-card">
        <CardContent className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardContent className="p-6 md:p-8 lg:p-10">
        {/* Top section */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-12">
          {/* Left - Revenue Overview */}
          <div className="flex-shrink-0 lg:w-[340px] flex flex-col justify-between space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                2026 Revenue Goal
              </p>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
                  {formatCurrency(stats.totalRevenue)}
                </span>
                <span className="text-2xl md:text-3xl font-light text-muted-foreground">/ $1.5M</span>
              </div>

              {/* Progress bar */}
              <div className="mt-5">
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, stats.goalProgress)}%`, backgroundColor: '#0066FF' }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {stats.goalProgress}% of annual goal
                </p>
              </div>
            </div>

            {/* Momentum message */}
            <div className="bg-muted/50 border border-border rounded-xl p-4">
              {stats.totalRevenue >= COMPANY_GOAL * 0.8 ? (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">On fire! 🔥</p>
                    <p className="text-xs text-muted-foreground">Keep this momentum going</p>
                  </div>
                </div>
              ) : stats.totalRevenue >= COMPANY_GOAL * 0.5 ? (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Halfway there!</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(remaining)} to go</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Building momentum</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(remaining)} to reach goal</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right - Chart */}
          <div className="flex-1 min-w-0 bg-muted/30 border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {chartPeriod === 'ytd' ? 'Revenue Breakdown' : 'Daily Revenue (MTD)'}
                </p>
                <Tabs value={chartPeriod} onValueChange={(v) => setChartPeriod(v as TimePeriod)}>
                  <TabsList className="h-7">
                    <TabsTrigger value="mtd" className="text-[10px] px-2.5 py-0.5 h-5">MTD</TabsTrigger>
                    <TabsTrigger value="ytd" className="text-[10px] px-2.5 py-0.5 h-5">YTD</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#0066FF' }} /> Revenue
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-[2px] rounded" style={{ backgroundColor: '#FF8000' }} /> Cumulative
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-[2px] border-t border-dashed" style={{ borderColor: 'rgba(0,102,255,0.4)' }} /> Trend
                </span>
              </div>
            </div>

            <div className="h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
                  <defs>
                    <linearGradient id="heroAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(255,128,0,0.15)" />
                      <stop offset="100%" stopColor="rgba(255,128,0,0.02)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    interval={chartPeriod === 'mtd' ? 2 : 0}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    tickFormatter={(value) => (value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value}`)}
                    width={55}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    tickFormatter={(value) => (value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value}`)}
                    width={55}
                  />
                  <ReferenceLine
                    yAxisId="right"
                    segment={[
                      { x: chartData[0]?.label, y: 0 },
                      { x: chartData[chartData.length - 1]?.label, y: stats.totalRevenue },
                    ]}
                    stroke="rgba(0,102,255,0.35)"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '10px',
                      color: 'hsl(var(--foreground))',
                      padding: '12px 16px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="text-sm bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold text-foreground mb-2">{label}</p>
                            <div className="space-y-1.5">
                              <p className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Revenue:</span>
                                <span className="font-semibold" style={{ color: '#0066FF' }}>{formatCurrencyFull(d.revenue)}</span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Cumulative:</span>
                                <span className="font-semibold" style={{ color: '#FF8000' }}>{formatCurrencyFull(d.cumulative)}</span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Deals:</span>
                                <span className="font-medium text-foreground">{d.deals}</span>
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="revenue"
                    fill="#0066FF"
                    radius={[4, 4, 0, 0]}
                    opacity={0.85}
                    barSize={chartPeriod === 'mtd' ? 12 : 28}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulative"
                    stroke="transparent"
                    fill="url(#heroAreaGradient)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#FF8000"
                    strokeWidth={2.5}
                    dot={{ fill: '#FF8000', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#FF8000', stroke: 'rgba(255,128,0,0.3)', strokeWidth: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Stats Footer */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-border">
          <div className="bg-muted/40 rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
              {stats.revenueLabel}
            </p>
            <p className="text-xl md:text-2xl font-bold mt-1 text-foreground">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">{stats.goalProgress}% of goal</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
              {stats.avgLabel}
            </p>
            <p className="text-xl md:text-2xl font-bold mt-1 text-foreground">{formatCurrency(stats.avgPerPoint)}</p>
            <p className="text-xs text-muted-foreground">{stats.activePoints} active {stats.pointLabel}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
              {stats.bestPointLabel}
            </p>
            <p className="text-xl md:text-2xl font-bold mt-1 text-foreground">{stats.bestLabel}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats.bestValue)}</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
              Deals Closed
            </p>
            <p className="text-xl md:text-2xl font-bold mt-1 text-foreground">{stats.totalDeals}</p>
            <p className="text-xs text-muted-foreground">Avg: {formatCurrency(stats.avgDealSize)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
