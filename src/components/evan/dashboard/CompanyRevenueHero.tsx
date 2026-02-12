import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Activity, TrendingUp, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ComposedChart,
  Area,
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

  // Build chart data
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
        return {
          label: format(month, 'MMM'),
          revenue,
          cumulative,
          deals: monthDeals.length,
        };
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
          totalRevenue,
          goalProgress: Math.round((totalRevenue / COMPANY_GOAL) * 100),
          avgPerPoint: avgPerMonth,
          activePoints: activeMonths.length,
          bestLabel: bestMonth.label,
          bestValue: bestMonth.revenue,
          totalDeals,
          avgDealSize,
          pointLabel: 'months',
          avgLabel: 'Monthly Avg',
          bestPointLabel: 'Best Month',
          revenueLabel: 'YTD Revenue',
        },
      };
    } else {
      // MTD - daily
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
        return {
          label: format(day, 'd'),
          revenue,
          cumulative,
          deals: dayDeals.length,
        };
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
          totalRevenue,
          goalProgress: Math.round((totalRevenue / monthlyTarget) * 100),
          avgPerPoint: avgPerDay,
          activePoints: activeDays.length,
          bestLabel: bestDay.label,
          bestValue: bestDay.revenue,
          totalDeals,
          avgDealSize,
          pointLabel: 'days',
          avgLabel: 'Daily Avg',
          bestPointLabel: 'Best Day',
          revenueLabel: 'MTD Revenue',
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
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground">
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin opacity-60" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground">
      {/* Background decorative elements */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />
      <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-white/[0.03] rounded-full" />

      <CardContent className="relative z-10 p-6 md:p-8 lg:p-10">
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-8 lg:gap-12">
          {/* Left - Revenue Overview */}
          <div className="flex-shrink-0 lg:w-[340px] flex flex-col justify-between space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.15em] opacity-60">
                2026 Revenue Goal
              </p>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="text-5xl md:text-6xl font-extrabold tracking-tight">
                  {formatCurrency(stats.totalRevenue)}
                </span>
                <span className="text-2xl md:text-3xl font-light opacity-50">/ $1.5M</span>
              </div>

              {/* Progress bar */}
              <div className="mt-5">
                <div className="h-2.5 w-full rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/80 transition-all duration-700"
                    style={{ width: `${Math.min(100, stats.goalProgress)}%` }}
                  />
                </div>
                <p className="text-xs opacity-50 mt-1.5">
                  {stats.goalProgress}% of annual goal
                </p>
              </div>
            </div>

            {/* Momentum message */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              {stats.totalRevenue >= COMPANY_GOAL * 0.8 ? (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <TrendingUp className="h-5 w-5 text-green-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">On fire! 🔥</p>
                    <p className="text-xs opacity-60">Keep this momentum going</p>
                  </div>
                </div>
              ) : stats.totalRevenue >= COMPANY_GOAL * 0.5 ? (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Target className="h-5 w-5 text-amber-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Halfway there!</p>
                    <p className="text-xs opacity-60">{formatCurrency(remaining)} to go</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/15">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Building momentum</p>
                    <p className="text-xs opacity-60">{formatCurrency(remaining)} to reach goal</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right - Chart */}
          <div className="flex-1 min-w-0 bg-white/[0.08] backdrop-blur-sm rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-50">
                  {chartPeriod === 'ytd' ? 'Cumulative Revenue' : 'Daily Revenue (MTD)'}
                </p>
                <Tabs value={chartPeriod} onValueChange={(v) => setChartPeriod(v as TimePeriod)}>
                  <TabsList className="bg-white/10 h-7">
                    <TabsTrigger value="mtd" className="text-[10px] px-2.5 py-0.5 h-5 text-white/60 data-[state=active]:bg-white/20 data-[state=active]:text-white">MTD</TabsTrigger>
                    <TabsTrigger value="ytd" className="text-[10px] px-2.5 py-0.5 h-5 text-white/60 data-[state=active]:bg-white/20 data-[state=active]:text-white">YTD</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="flex items-center gap-4 text-[10px] opacity-40">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-[2px] bg-white/80 rounded" /> Actual
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-[2px] border-t border-dashed border-sky-300/60" /> Trend
                </span>
              </div>
            </div>

            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
                  <defs>
                    <linearGradient id="heroAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                    interval={chartPeriod === 'mtd' ? 2 : 0}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                    tickFormatter={(value) => (value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value}`)}
                    width={50}
                  />
                  <ReferenceLine
                    segment={[
                      { x: chartData[0]?.label, y: 0 },
                      { x: chartData[chartData.length - 1]?.label, y: stats.totalRevenue },
                    ]}
                    stroke="rgba(147, 197, 253, 0.4)"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: 'white',
                      padding: '12px 16px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="text-sm">
                            <p className="font-semibold text-white mb-2">{label}</p>
                            <div className="space-y-1.5">
                              <p className="flex justify-between gap-4">
                                <span className="text-white/60">Cumulative:</span>
                                <span className="font-semibold">{formatCurrencyFull(d.cumulative)}</span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-white/60">{chartPeriod === 'ytd' ? 'Month' : 'Day'}:</span>
                                <span className="font-medium">{formatCurrencyFull(d.revenue)}</span>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span className="text-white/60">Deals:</span>
                                <span className="font-medium">{d.deals}</span>
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="transparent" fill="url(#heroAreaGradient)" />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={2.5}
                    dot={{ fill: 'white', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: 'white', stroke: 'rgba(255,255,255,0.3)', strokeWidth: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Stats Footer */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] opacity-40 font-medium">
              {stats.revenueLabel}
            </p>
            <p className="text-xl md:text-2xl font-bold mt-1">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-xs opacity-50">{stats.goalProgress}% of goal</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] opacity-40 font-medium">
              {stats.avgLabel}
            </p>
            <p className="text-xl md:text-2xl font-bold mt-1">{formatCurrency(stats.avgPerPoint)}</p>
            <p className="text-xs opacity-50">{stats.activePoints} active {stats.pointLabel}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] opacity-40 font-medium">
              {stats.bestPointLabel}
            </p>
            <p className="text-xl md:text-2xl font-bold mt-1">{stats.bestLabel}</p>
            <p className="text-xs opacity-50">{formatCurrency(stats.bestValue)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] opacity-40 font-medium">
              Deals Closed
            </p>
            <p className="text-xl md:text-2xl font-bold mt-1">{stats.totalDeals}</p>
            <p className="text-xs opacity-50">Avg: {formatCurrency(stats.avgDealSize)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
