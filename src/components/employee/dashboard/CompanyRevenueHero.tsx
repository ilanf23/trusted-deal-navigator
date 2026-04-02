import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp, TrendingDown, Loader2,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DbTableBadge } from '@/components/admin/DbTableBadge';
import {
  ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import {
  startOfYear, startOfMonth, startOfQuarter, format,
  eachMonthOfInterval, eachDayOfInterval, endOfDay, addMonths,
} from 'date-fns';
import { cn } from '@/lib/utils';
import type { TimePeriod } from '@/pages/admin/Dashboard';
import type { ConfidenceData } from '@/components/admin/dashboard/useDashboardData';

interface CompanyRevenueHeroProps {
  chartPeriod: TimePeriod;
  setChartPeriod: (v: TimePeriod) => void;
  confidence?: ConfidenceData;
}

const STAGE_WEIGHTS: Record<string, number> = {
  discovery: 0.10,
  pre_qualification: 0.25,
  document_collection: 0.45,
  underwriting: 0.65,
  approval: 0.85,
};

const COLORS = {
  revenue: '#0066FF',
  cumulative: '#FF8000',
  forecast: '#8B5CF6',
  confidenceHigh: 'rgba(139,92,246,0.10)',
  confidenceLow: 'rgba(139,92,246,0.03)',
  onTrack: '#10B981',
  atRisk: '#F59E0B',
  belowTarget: '#EF4444',
};

export const CompanyRevenueHero = ({ chartPeriod, setChartPeriod, confidence: externalConfidence }: CompanyRevenueHeroProps) => {
  const COMPANY_GOAL = 1500000;
  const now = new Date();

  const [visibleSeries, setVisibleSeries] = useState({
    revenue: true,
    cumulative: true,
    forecast: true,
    confidence: true,
  });

  const toggleSeries = useCallback((key: keyof typeof visibleSeries) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Funded deals from leads table — single source of truth
  const { data: teamDeals = [], isLoading } = useQuery({
    queryKey: ['company-revenue-hero-leads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, name, converted_at, created_at, lead_responses(loan_amount)')
        .eq('status', 'funded')
        .gte('converted_at', startOfYear(now).toISOString())
        .order('converted_at', { ascending: true });
      return (data || []).map((d: any) => {
        const loanAmount = d.lead_responses?.[0]?.loan_amount || 0;
        return {
          rep: d.name,
          loanAmount,
          fee: loanAmount * 0.01,
          fundedAt: d.converted_at,
        };
      });
    },
  });

  // Pipeline deals for forecast
  const { data: pipelineDeals = [] } = useQuery({
    queryKey: ['company-revenue-hero-pipeline'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, status, lead_responses(loan_amount)')
        .neq('status', 'won')
        .neq('status', 'funded')
        .neq('status', 'lost');
      return (data || []).map((d: any) => ({
        id: d.id,
        status: d.status,
        loanAmount: d.lead_responses?.[0]?.loan_amount || 0,
      }));
    },
  });

  const { chartData, stats, kpis } = useMemo(() => {
    const yearStart = startOfYear(now);
    const monthStart = startOfMonth(now);
    const quarterStart = startOfQuarter(now);

    // Always compute YTD for overview stats
    const ytdMonths = eachMonthOfInterval({ start: yearStart, end: now });
    let ytdCumulative = 0;
    const ytdData = ytdMonths.map((month) => {
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      const monthDeals = teamDeals.filter((d) => {
        const date = new Date(d.fundedAt);
        return date >= month && date <= monthEnd;
      });
      const revenue = monthDeals.reduce((s, d) => s + d.fee, 0);
      ytdCumulative += revenue;
      return { label: format(month, 'MMM'), revenue, cumulative: ytdCumulative, deals: monthDeals.length };
    });

    const totalRevenue = ytdCumulative;

    // Pipeline weighted forecast
    const pipelineWeightedRevenue = pipelineDeals.reduce((sum, d) => {
      const weight = STAGE_WEIGHTS[d.status] || 0.1;
      return sum + (d.loanAmount * 0.01 * weight);
    }, 0);

    // Average monthly revenue from active months
    const activeYtdMonths = ytdData.filter(d => d.revenue > 0);
    const avgMonthlyRevenue = activeYtdMonths.length > 0
      ? activeYtdMonths.reduce((s, d) => s + d.revenue, 0) / activeYtdMonths.length
      : 0;

    const remainingMonths = 12 - (now.getMonth() + 1);
    const forecastTotal = totalRevenue + pipelineWeightedRevenue + avgMonthlyRevenue * Math.max(0, remainingMonths - 2);
    const forecastBest = forecastTotal * 1.2;
    const forecastConservative = forecastTotal * 0.8;

    // Use unified confidence from useDashboardData (single source of truth)
    const confidenceLevel = externalConfidence?.score ?? 50;
    const healthStatus: 'on-track' | 'at-risk' | 'below-target' =
      externalConfidence?.status ?? (confidenceLevel >= 65 ? 'on-track' : confidenceLevel >= 40 ? 'at-risk' : 'below-target');

    // Growth rate
    const growthRate = activeYtdMonths.length > 1
      ? Math.round(((activeYtdMonths[activeYtdMonths.length - 1].revenue - activeYtdMonths[0].revenue) / Math.max(1, activeYtdMonths[0].revenue)) * 100)
      : 0;

    // Build period-specific chart data
    let data: any[] = [];
    let periodStats: any = {};

    if (chartPeriod === 'ytd') {
      // Build forecast points for future months
      const forecastPoints: any[] = [];
      let fcCum = totalRevenue;
      const futureMonths = eachMonthOfInterval({
        start: addMonths(now, 1),
        end: new Date(now.getFullYear(), 11, 31),
      });
      futureMonths.forEach((m) => {
        fcCum += avgMonthlyRevenue;
        forecastPoints.push({
          label: format(m, 'MMM'),
          forecastCumulative: fcCum,
          confidenceHigh: fcCum * 1.15,
          confidenceLow: fcCum * 0.75,
          goalPace: (COMPANY_GOAL / 12) * (m.getMonth() + 1),
        });
      });

      // Add goalPace to historical data
      const historicalWithGoal = ytdData.map((d, i) => ({
        ...d,
        goalPace: (COMPANY_GOAL / 12) * (i + 1),
      }));

      data = [...historicalWithGoal, ...forecastPoints];

      const bestMonth = ytdData.reduce((best, m) => (m.revenue > best.revenue ? m : best), { label: '-', revenue: 0 });
      periodStats = {
        totalRevenue,
        goalProgress: Math.round((totalRevenue / COMPANY_GOAL) * 100),
        avgPerPoint: avgMonthlyRevenue,
        activePoints: activeYtdMonths.length,
        bestLabel: bestMonth.label,
        bestValue: bestMonth.revenue,
        totalDeals: teamDeals.length,
        avgDealSize: teamDeals.length > 0 ? totalRevenue / teamDeals.length : 0,
        pointLabel: 'months',
        avgLabel: 'Monthly Avg',
        bestPointLabel: 'Best Month',
        revenueLabel: 'YTD Revenue',
      };
    } else if (chartPeriod === 'qtd') {
      const days = eachDayOfInterval({ start: quarterStart, end: now });
      let cum = 0;
      const qtdDeals = teamDeals.filter(d => new Date(d.fundedAt) >= quarterStart);
      const dayData = days.map((day) => {
        const dayEnd = endOfDay(day);
        const dayDeals = qtdDeals.filter(d => {
          const date = new Date(d.fundedAt);
          return date >= day && date <= dayEnd;
        });
        const revenue = dayDeals.reduce((s, d) => s + d.fee, 0);
        cum += revenue;
        return { label: format(day, 'MMM d'), revenue, cumulative: cum, deals: dayDeals.length };
      });
      data = dayData;
      const quarterTarget = COMPANY_GOAL / 4;
      const activeDays = dayData.filter(d => d.revenue > 0);
      const avgPerDay = activeDays.length > 0 ? cum / activeDays.length : 0;
      const bestDay = dayData.reduce((best, d) => (d.revenue > best.revenue ? d : best), { label: '-', revenue: 0 });
      periodStats = {
        totalRevenue: cum,
        goalProgress: Math.round((cum / quarterTarget) * 100),
        avgPerPoint: avgPerDay,
        activePoints: activeDays.length,
        bestLabel: bestDay.label,
        bestValue: bestDay.revenue,
        totalDeals: qtdDeals.length,
        avgDealSize: qtdDeals.length > 0 ? cum / qtdDeals.length : 0,
        pointLabel: 'days',
        avgLabel: 'Daily Avg',
        bestPointLabel: 'Best Day',
        revenueLabel: 'QTD Revenue',
      };
    } else {
      // MTD
      const days = eachDayOfInterval({ start: monthStart, end: now });
      let cum = 0;
      const mtdDeals = teamDeals.filter(d => new Date(d.fundedAt) >= monthStart);
      const dayData = days.map((day) => {
        const dayEnd = endOfDay(day);
        const dayDeals = mtdDeals.filter(d => {
          const date = new Date(d.fundedAt);
          return date >= day && date <= dayEnd;
        });
        const revenue = dayDeals.reduce((s, d) => s + d.fee, 0);
        cum += revenue;
        return { label: format(day, 'd'), revenue, cumulative: cum, deals: dayDeals.length };
      });
      data = dayData;
      const monthlyTarget = 125000;
      const activeDays = dayData.filter(d => d.revenue > 0);
      const avgPerDay = activeDays.length > 0 ? cum / activeDays.length : 0;
      const bestDay = dayData.reduce((best, d) => (d.revenue > best.revenue ? d : best), { label: '-', revenue: 0 });
      periodStats = {
        totalRevenue: cum,
        goalProgress: Math.round((cum / monthlyTarget) * 100),
        avgPerPoint: avgPerDay,
        activePoints: activeDays.length,
        bestLabel: bestDay.label,
        bestValue: bestDay.revenue,
        totalDeals: mtdDeals.length,
        avgDealSize: mtdDeals.length > 0 ? cum / mtdDeals.length : 0,
        pointLabel: 'days',
        avgLabel: 'Daily Avg',
        bestPointLabel: 'Best Day',
        revenueLabel: 'MTD Revenue',
      };
    }

    return {
      chartData: data,
      stats: periodStats,
      kpis: {
        totalRevenue,
        goalProgress: Math.round((totalRevenue / COMPANY_GOAL) * 100),
        growthRate,
        confidenceLevel,
        healthStatus,
        forecastTotal,
        forecastBest,
        forecastConservative,
        revenueGap: Math.max(0, COMPANY_GOAL - totalRevenue),
        pipelineWeightedRevenue,
        forecastAccuracy: forecastTotal > 0 ? Math.min(100, Math.round((totalRevenue / forecastTotal) * 100)) : 0,
      },
    };
  }, [teamDeals, pipelineDeals, chartPeriod, now]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatCurrencyFull = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const remaining = Math.max(0, COMPANY_GOAL - kpis.totalRevenue);

  const healthColors = {
    'on-track': { bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', icon: CheckCircle2, label: 'High Confidence' },
    'at-risk': { bg: 'bg-amber-500/10 dark:bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', icon: AlertTriangle, label: 'Moderate Confidence' },
    'below-target': { bg: 'bg-red-500/10 dark:bg-red-500/15', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20', icon: TrendingDown, label: 'Low Confidence' },
  };
  const health = healthColors[kpis.healthStatus];
  const HealthIcon = health.icon;

  // Milestone markers for YTD cumulative axis
  const milestoneValues = [COMPANY_GOAL * 0.25, COMPANY_GOAL * 0.5, COMPANY_GOAL * 0.75];

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
    <Card className="border border-border bg-card shadow-sm overflow-hidden">
      {/* Health Status Bar */}
      <div className={cn("px-4 md:px-6 py-2 flex items-center gap-3 border-b", health.bg, health.border)}>
        <HealthIcon className={cn("h-3.5 w-3.5", health.text)} />
        <span className={cn("text-xs font-semibold", health.text)}>{health.label}</span>
        <span className="text-[11px] text-muted-foreground">{kpis.confidenceLevel}% confidence</span>
        <span className="text-[11px] text-muted-foreground">·</span>
        <span className={cn("text-[11px] font-medium", health.text)}>Forecast: {formatCurrency(kpis.forecastTotal)}</span>
      </div>

      <CardContent className="p-6 md:p-8 lg:p-10">
        {/* Revenue header row */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              2026 Revenue Goal
            </p>
            <DbTableBadge tables={['leads']} />
            <div className="flex items-baseline gap-3 mt-1.5">
              <span className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                {formatCurrency(kpis.totalRevenue)}
              </span>
              <span className="text-xl md:text-2xl font-light text-muted-foreground">/ $1.5M</span>
            </div>
            <div className="mt-3 max-w-sm">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, kpis.goalProgress)}%`, backgroundColor: COLORS.revenue }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {kpis.goalProgress}% of annual goal · {formatCurrency(remaining)} to go
              </p>
            </div>
          </div>

          {/* Inline KPIs */}
          <div className="flex items-center divide-x divide-border rounded-lg border border-border bg-muted/30">
            <div className="px-5 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Forecast</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{formatCurrency(kpis.forecastTotal)}</p>
            </div>
            <div className="px-5 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Pipeline</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{formatCurrency(kpis.pipelineWeightedRevenue)}</p>
            </div>
            <div className="px-5 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Growth</p>
              <p className={cn("text-sm font-bold mt-0.5", kpis.growthRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                {kpis.growthRate >= 0 ? '+' : ''}{kpis.growthRate}%
              </p>
            </div>
          </div>
        </div>

        {/* Chart — full width */}
        <div className="bg-card dark:bg-slate-900/50 border border-border/60 rounded-xl shadow-sm p-3 md:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div className="flex items-center gap-3">
                <p className="text-[13px] font-semibold text-foreground">
                  {chartPeriod === 'ytd' ? 'Revenue Breakdown' : chartPeriod === 'qtd' ? 'Quarter to Date' : 'Daily Revenue (MTD)'}
                </p>
                <Tabs value={chartPeriod} onValueChange={(v) => setChartPeriod(v as TimePeriod)}>
                  <TabsList className="h-7 bg-transparent p-0 gap-1">
                    {(['mtd', 'qtd', 'ytd'] as const).map((tab) => (
                      <TabsTrigger
                        key={tab}
                        value={tab}
                        className="text-[11px] px-3 py-0.5 h-5 rounded-full font-medium data-[state=active]:bg-[#1D4ED8] data-[state=active]:text-white data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground border-0 shadow-none"
                      >
                        {tab.toUpperCase()}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              {/* Interactive Legend */}
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { key: 'revenue' as const, label: 'Revenue', color: '#3B82F6', type: 'bar' },
                  { key: 'cumulative' as const, label: 'Cumulative', color: '#F97316', type: 'line' },
                  ...(chartPeriod === 'ytd' ? [
                    { key: 'forecast' as const, label: 'Forecast', color: '#8B5CF6', type: 'line' },
                    { key: 'confidence' as const, label: 'Confidence', color: '#8B5CF6', type: 'area' },
                  ] : []),
                ].map(({ key, label, color, type }) => (
                  <button
                    key={key}
                    onClick={() => toggleSeries(key)}
                    className={cn(
                      "flex items-center gap-1.5 cursor-pointer transition-opacity",
                      !visibleSeries[key] && "opacity-30"
                    )}
                  >
                    {type === 'bar' ? (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    ) : type === 'area' ? (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, opacity: 0.3 }} />
                    ) : (
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    )}
                    <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[280px] md:h-[380px] lg:h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="heroAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(249,115,22,0.12)" />
                      <stop offset="100%" stopColor="rgba(249,115,22,0.01)" />
                    </linearGradient>
                    <linearGradient id="forecastConfidence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(139,92,246,0.10)" />
                      <stop offset="100%" stopColor="rgba(139,92,246,0.02)" />
                    </linearGradient>
                    <linearGradient id="revenueBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#6B7280" strokeWidth={0.5} strokeOpacity={0.2} vertical={false} strokeDasharray="" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                    interval={chartPeriod === 'mtd' ? 2 : chartPeriod === 'qtd' ? 6 : 0}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                    tickFormatter={(value) => (value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value}`)}
                    width={52}
                    tickCount={5}
                    allowDecimals={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                    tickFormatter={(value) => (value >= 1000000 ? `$${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value}`)}
                    width={56}
                    tickCount={5}
                    allowDecimals={false}
                    padding={{ top: 12, bottom: 12 }}
                  />

                  {/* Goal Pace reference line (YTD only) */}
                  {chartPeriod === 'ytd' && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="goalPace"
                      stroke="#10B981"
                      strokeDasharray="6 4"
                      strokeWidth={1}
                      dot={false}
                      activeDot={false}
                      connectNulls
                    />
                  )}

                  {/* Milestone markers (YTD only) */}
                  {chartPeriod === 'ytd' && milestoneValues.map((val) => (
                    <ReferenceLine
                      key={val}
                      yAxisId="right"
                      y={val}
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      label={{
                        value: formatCurrency(val),
                        position: 'insideTopRight',
                        fill: '#9CA3AF',
                        fontSize: 9,
                        offset: 8,
                      }}
                    />
                  ))}

                  {/* Confidence band (YTD forecast) */}
                  {chartPeriod === 'ytd' && visibleSeries.confidence && (
                    <>
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="confidenceHigh"
                        stroke="transparent"
                        fill="url(#forecastConfidence)"
                        connectNulls
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="confidenceLow"
                        stroke="transparent"
                        fill="transparent"
                        connectNulls
                      />
                    </>
                  )}

                  {/* Cumulative area fill */}
                  {visibleSeries.cumulative && (
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulative"
                      stroke="transparent"
                      fill="url(#heroAreaGradient)"
                    />
                  )}

                  {/* Revenue bars */}
                  {visibleSeries.revenue && (
                    <Bar
                      yAxisId="left"
                      dataKey="revenue"
                      fill="url(#revenueBarGradient)"
                      radius={[4, 4, 0, 0]}
                      opacity={0.9}
                      barSize={chartPeriod === 'ytd' ? 20 : 8}
                    />
                  )}

                  {/* Cumulative line */}
                  {visibleSeries.cumulative && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#F97316"
                      strokeWidth={2}
                      dot={{ fill: '#F97316', strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5, fill: '#F97316', stroke: 'rgba(249,115,22,0.3)', strokeWidth: 3 }}
                    />
                  )}

                  {/* Forecast line (YTD only) */}
                  {chartPeriod === 'ytd' && visibleSeries.forecast && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="forecastCumulative"
                      stroke="#8B5CF6"
                      strokeWidth={1.5}
                      strokeDasharray="8 4"
                      dot={{ fill: '#8B5CF6', strokeWidth: 0, r: 2.5 }}
                      activeDot={{ r: 4, fill: '#8B5CF6' }}
                      connectNulls
                    />
                  )}

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="text-sm bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold text-foreground mb-2">{label}</p>
                            <div className="space-y-1.5">
                              {d.revenue !== undefined && (
                                <p className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Revenue:</span>
                                  <span className="font-semibold" style={{ color: COLORS.revenue }}>{formatCurrencyFull(d.revenue)}</span>
                                </p>
                              )}
                              {d.cumulative !== undefined && (
                                <p className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Cumulative:</span>
                                  <span className="font-semibold" style={{ color: COLORS.cumulative }}>{formatCurrencyFull(d.cumulative)}</span>
                                </p>
                              )}
                              {d.forecastCumulative !== undefined && (
                                <p className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Forecast:</span>
                                  <span className="font-semibold" style={{ color: COLORS.forecast }}>{formatCurrencyFull(d.forecastCumulative)}</span>
                                </p>
                              )}
                              {d.deals !== undefined && (
                                <p className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Deals:</span>
                                  <span className="font-medium text-foreground">{d.deals}</span>
                                </p>
                              )}
                              {d.goalPace !== undefined && (
                                <p className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Goal Pace:</span>
                                  <span className="font-medium text-muted-foreground">{formatCurrencyFull(d.goalPace)}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        {/* Stats Footer — cohesive data strip */}
        <div className="flex items-start divide-x divide-border mt-8 pt-6 border-t border-border">
          <div className="flex-1 px-4 first:pl-0">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{stats.revenueLabel}</p>
            <p className="text-xl font-bold mt-1 text-foreground">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">{stats.goalProgress}% of goal</p>
          </div>
          <div className="flex-1 px-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{stats.avgLabel}</p>
            <p className="text-xl font-bold mt-1 text-foreground">{formatCurrency(stats.avgPerPoint)}</p>
            <p className="text-xs text-muted-foreground">{stats.activePoints} active {stats.pointLabel}</p>
          </div>
          <div className="flex-1 px-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">{stats.bestPointLabel}</p>
            <p className="text-xl font-bold mt-1 text-foreground">{stats.bestLabel}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats.bestValue)}</p>
          </div>
          <div className="flex-1 px-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">Deals Closed</p>
            <p className="text-xl font-bold mt-1 text-foreground">{stats.totalDeals}</p>
            <p className="text-xs text-muted-foreground">Avg: {formatCurrency(stats.avgDealSize)}</p>
          </div>
          <div className="flex-1 px-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">Forecast</p>
            <p className="text-xl font-bold mt-1 text-foreground">{formatCurrency(kpis.forecastTotal)}</p>
            <p className="text-xs text-muted-foreground">End-of-year projected</p>
          </div>
          <div className="flex-1 px-4 last:pr-0">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">Growth Rate</p>
            <p className={cn("text-xl font-bold mt-1", kpis.growthRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
              {kpis.growthRate >= 0 ? '+' : ''}{kpis.growthRate}%
            </p>
            <p className="text-xs text-muted-foreground">Period trend</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
