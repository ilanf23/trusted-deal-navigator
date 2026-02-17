import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Target, Activity, TrendingUp, TrendingDown, Loader2, DollarSign,
  ChevronUp, ChevronDown, Download, CalendarDays, Eye, EyeOff,
  AlertTriangle, CheckCircle2, ArrowUpRight, BarChart3, Zap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import {
  startOfYear, startOfMonth, startOfQuarter, format, eachMonthOfInterval,
  eachDayOfInterval, endOfDay, subDays, differenceInDays, eachQuarterOfInterval,
  endOfQuarter, endOfMonth, isWithinInterval, addMonths,
} from 'date-fns';
import { cn } from '@/lib/utils';
import type { TimePeriod } from '@/pages/admin/EvansPage';

type ChartView = 'mtd' | 'ytd' | 'quarterly' | 'custom';
type TrendWindow = 30 | 60 | 90;

interface RevenueProjectionChartProps {
  className?: string;
}

const COLORS = {
  revenue: '#0066FF',
  cumulative: '#FF8000',
  forecast: '#8B5CF6',
  target: 'rgba(0,102,255,0.25)',
  confidenceHigh: 'rgba(139,92,246,0.12)',
  confidenceLow: 'rgba(139,92,246,0.04)',
  milestone: '#10B981',
  onTrack: '#10B981',
  atRisk: '#F59E0B',
  belowTarget: '#EF4444',
};

export const RevenueProjectionChart = ({ className }: RevenueProjectionChartProps) => {
  const COMPANY_GOAL = 1500000;
  const now = new Date();

  const [chartView, setChartView] = useState<ChartView>('ytd');
  const [trendWindow, setTrendWindow] = useState<TrendWindow>(30);
  const [visibleSeries, setVisibleSeries] = useState({
    revenue: true,
    cumulative: true,
    forecast: true,
    target: true,
    trend: true,
  });
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [expandedTooltip, setExpandedTooltip] = useState(false);

  const { data: teamDeals = [], isLoading } = useQuery({
    queryKey: ['revenue-projection-deals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_funded_deals')
        .select('rep_name, loan_amount, fee_earned, days_in_pipeline, funded_at, notes')
        .gte('funded_at', startOfYear(now).toISOString())
        .order('funded_at', { ascending: true });
      return (data || []).map((d: any) => ({
        rep: d.rep_name,
        loanAmount: Number(d.loan_amount),
        fee: Number(d.fee_earned),
        fundedAt: d.funded_at,
        daysInPipeline: d.days_in_pipeline,
        notes: d.notes,
      }));
    },
  });

  // Pipeline deals for forecasting
  const { data: pipelineDeals = [] } = useQuery({
    queryKey: ['revenue-projection-pipeline'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, status, created_at, lead_responses(loan_amount)')
        .neq('status', 'funded')
        .neq('status', 'lost');
      return (data || []).map((d: any) => ({
        id: d.id,
        status: d.status,
        createdAt: d.created_at,
        loanAmount: d.lead_responses?.[0]?.loan_amount || 0,
      }));
    },
  });

  const toggleSeries = useCallback((key: keyof typeof visibleSeries) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatCurrencyFull = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  // Stage conversion probabilities for weighted forecast
  const STAGE_WEIGHTS: Record<string, number> = {
    discovery: 0.10,
    pre_qualification: 0.25,
    document_collection: 0.45,
    underwriting: 0.65,
    approval: 0.85,
  };

  // Build chart data
  const { chartData, kpis, forecastData } = useMemo(() => {
    const getRange = () => {
      if (chartView === 'custom' && dateRange.from && dateRange.to) {
        return { start: dateRange.from, end: dateRange.to };
      }
      if (chartView === 'quarterly') {
        return { start: startOfQuarter(now), end: now };
      }
      if (chartView === 'mtd') {
        return { start: startOfMonth(now), end: now };
      }
      return { start: startOfYear(now), end: now };
    };

    const { start, end } = getRange();
    const isMonthly = chartView === 'ytd' || (chartView === 'custom' && differenceInDays(end, start) > 62);
    const isQuarterly = chartView === 'quarterly' && differenceInDays(end, start) > 180;

    let intervals: Date[];
    let labelFormat: string;
    
    if (isQuarterly) {
      intervals = eachQuarterOfInterval({ start, end });
      labelFormat = "QQQ ''yy";
    } else if (isMonthly) {
      intervals = eachMonthOfInterval({ start, end });
      labelFormat = 'MMM';
    } else {
      intervals = eachDayOfInterval({ start, end });
      labelFormat = chartView === 'mtd' ? 'd' : 'MMM d';
    }

    let cumulative = 0;
    let prevRevenue = 0;
    const targetPerInterval = isMonthly ? COMPANY_GOAL / 12 : isQuarterly ? COMPANY_GOAL / 4 : COMPANY_GOAL / 365;

    const data = intervals.map((interval, i) => {
      const intervalEnd = isQuarterly
        ? endOfQuarter(interval)
        : isMonthly
        ? endOfMonth(interval)
        : endOfDay(interval);

      const periodDeals = teamDeals.filter((d) => {
        const date = new Date(d.fundedAt);
        return date >= interval && date <= intervalEnd;
      });

      const revenue = periodDeals.reduce((s, d) => s + d.fee, 0);
      cumulative += revenue;
      const growth = i > 0 && prevRevenue > 0
        ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100)
        : 0;
      const cumulativeTarget = targetPerInterval * (i + 1);
      
      prevRevenue = revenue;

      return {
        label: format(interval, labelFormat),
        revenue,
        cumulative,
        target: targetPerInterval,
        cumulativeTarget,
        deals: periodDeals.length,
        growth,
        avgDealSize: periodDeals.length > 0 ? revenue / periodDeals.length : 0,
      };
    });

    // Forecast projection (simple linear + pipeline-weighted)
    const activeMonths = data.filter(d => d.revenue > 0);
    const avgRevenue = activeMonths.length > 0
      ? activeMonths.reduce((s, d) => s + d.revenue, 0) / activeMonths.length
      : 0;

    // Pipeline weighted value
    const pipelineWeightedRevenue = pipelineDeals.reduce((sum, d) => {
      const weight = STAGE_WEIGHTS[d.status] || 0.1;
      return sum + (d.loanAmount * 0.02 * weight);
    }, 0);

    const remainingMonths = 12 - (now.getMonth() + 1);
    const linearForecast = cumulative + avgRevenue * remainingMonths;
    const weightedForecast = cumulative + pipelineWeightedRevenue + avgRevenue * Math.max(0, remainingMonths - 2);
    const forecastBest = Math.max(linearForecast, weightedForecast) * 1.1;
    const forecastWorst = Math.min(linearForecast, weightedForecast) * 0.8;
    const forecastLikely = (linearForecast + weightedForecast) / 2;

    // Build forecast line for future months (YTD only)
    const forecastPoints: any[] = [];
    if (chartView === 'ytd' && isMonthly) {
      let fcCum = cumulative;
      const futureMonths = eachMonthOfInterval({
        start: addMonths(now, 1),
        end: new Date(now.getFullYear(), 11, 31),
      });
      futureMonths.forEach((m) => {
        fcCum += avgRevenue;
        forecastPoints.push({
          label: format(m, 'MMM'),
          forecastRevenue: avgRevenue,
          forecastCumulative: fcCum,
          confidenceHigh: fcCum * 1.15,
          confidenceLow: fcCum * 0.75,
          cumulativeTarget: targetPerInterval * (m.getMonth() + 1),
        });
      });
    }

    // KPIs
    const totalRevenue = cumulative;
    const goalProgress = Math.round((totalRevenue / COMPANY_GOAL) * 100);
    const growthRate = activeMonths.length > 1
      ? Math.round(((activeMonths[activeMonths.length - 1].revenue - activeMonths[0].revenue) / Math.max(1, activeMonths[0].revenue)) * 100)
      : 0;
    const forecastAccuracy = forecastLikely > 0
      ? Math.round((totalRevenue / forecastLikely) * 100)
      : 0;
    const revenueGap = COMPANY_GOAL - totalRevenue;
    const targetVariance = Math.round(((totalRevenue - (targetPerInterval * data.length)) / Math.max(1, targetPerInterval * data.length)) * 100);

    // Health status
    const healthStatus: 'on-track' | 'at-risk' | 'below-target' =
      targetVariance >= 0 ? 'on-track' : targetVariance >= -15 ? 'at-risk' : 'below-target';

    return {
      chartData: [...data, ...forecastPoints.map(fp => ({ ...fp, revenue: undefined, cumulative: undefined }))],
      forecastData: forecastPoints,
      kpis: {
        totalRevenue,
        goalProgress,
        growthRate,
        forecastAccuracy: Math.min(100, forecastAccuracy),
        revenueGap,
        targetVariance,
        healthStatus,
        forecastLikely,
        forecastBest,
        forecastWorst,
        avgRevenue,
        totalDeals: teamDeals.length,
        avgDealSize: teamDeals.length > 0 ? totalRevenue / teamDeals.length : 0,
        pipelineWeightedRevenue,
        activeMonths: activeMonths.length,
      },
    };
  }, [teamDeals, pipelineDeals, chartView, dateRange, now]);

  const healthColors = {
    'on-track': { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20', icon: CheckCircle2 },
    'at-risk': { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20', icon: AlertTriangle },
    'below-target': { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/20', icon: TrendingDown },
  };

  const health = healthColors[kpis.healthStatus];
  const HealthIcon = health.icon;

  // Milestones
  const milestones = [
    { label: '$250K', value: 250000, hit: kpis.totalRevenue >= 250000 },
    { label: '$500K', value: 500000, hit: kpis.totalRevenue >= 500000 },
    { label: '$750K', value: 750000, hit: kpis.totalRevenue >= 750000 },
    { label: '$1M', value: 1000000, hit: kpis.totalRevenue >= 1000000 },
    { label: '$1.25M', value: 1250000, hit: kpis.totalRevenue >= 1250000 },
    { label: '$1.5M', value: 1500000, hit: kpis.totalRevenue >= 1500000 },
  ];

  const nextMilestone = milestones.find(m => !m.hit);

  if (isLoading) {
    return (
      <Card className={cn("border border-border bg-card", className)}>
        <CardContent className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border border-border bg-card shadow-sm overflow-hidden", className)}>
      <CardContent className="p-0">
        {/* Health Status Bar */}
        <div className={cn("px-6 py-3 flex items-center justify-between border-b", health.bg, health.border)}>
          <div className="flex items-center gap-2">
            <HealthIcon className={cn("h-4 w-4", health.text)} />
            <span className={cn("text-sm font-semibold", health.text)}>
              {kpis.healthStatus === 'on-track' ? 'On Track' : kpis.healthStatus === 'at-risk' ? 'At Risk' : 'Below Target'}
            </span>
            <span className="text-xs text-muted-foreground">
              {kpis.targetVariance >= 0 ? '+' : ''}{kpis.targetVariance}% vs plan
            </span>
          </div>
          <div className="flex items-center gap-3">
            {nextMilestone && (
              <Badge variant="outline" className="text-xs gap-1">
                <Target className="h-3 w-3" />
                Next: {nextMilestone.label}
              </Badge>
            )}
            <Badge variant="outline" className={cn("text-xs", health.text, health.border)}>
              Forecast: {formatCurrency(kpis.forecastLikely)}
            </Badge>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {/* KPI Badges Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {[
              { label: 'Revenue', value: formatCurrency(kpis.totalRevenue), sub: `${kpis.goalProgress}% of goal`, icon: DollarSign, color: 'text-primary' },
              { label: 'Growth Rate', value: `${kpis.growthRate >= 0 ? '+' : ''}${kpis.growthRate}%`, sub: 'Period over period', icon: kpis.growthRate >= 0 ? TrendingUp : TrendingDown, color: kpis.growthRate >= 0 ? 'text-emerald-600' : 'text-red-500' },
              { label: 'Target Variance', value: `${kpis.targetVariance >= 0 ? '+' : ''}${kpis.targetVariance}%`, sub: 'vs plan pace', icon: Target, color: kpis.targetVariance >= 0 ? 'text-emerald-600' : 'text-amber-500' },
              { label: 'Forecast Accuracy', value: `${kpis.forecastAccuracy}%`, sub: 'Actual vs projected', icon: Activity, color: 'text-purple-500' },
              { label: 'Revenue Gap', value: formatCurrency(kpis.revenueGap), sub: 'To reach $1.5M', icon: BarChart3, color: 'text-muted-foreground' },
              { label: 'Pipeline Value', value: formatCurrency(kpis.pipelineWeightedRevenue), sub: 'Weighted by stage', icon: Zap, color: 'text-amber-500' },
            ].map((kpi) => (
              <div key={kpi.label} className="p-3 rounded-xl border bg-card hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-1.5 mb-1">
                  <kpi.icon className={cn("h-3.5 w-3.5", kpi.color)} />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{kpi.label}</span>
                </div>
                <p className="text-lg font-bold text-foreground">{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Chart Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Tabs value={chartView} onValueChange={(v) => setChartView(v as ChartView)}>
                <TabsList className="h-8">
                  <TabsTrigger value="mtd" className="text-xs px-3 h-6">MTD</TabsTrigger>
                  <TabsTrigger value="quarterly" className="text-xs px-3 h-6">QTD</TabsTrigger>
                  <TabsTrigger value="ytd" className="text-xs px-3 h-6">YTD</TabsTrigger>
                  <TabsTrigger value="custom" className="text-xs px-3 h-6">Custom</TabsTrigger>
                </TabsList>
              </Tabs>

              {chartView === 'custom' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {dateRange.from ? format(dateRange.from, 'MMM d') : 'Start'} - {dateRange.to ? format(dateRange.to, 'MMM d') : 'End'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange as any}
                      onSelect={(range: any) => setDateRange(range || {})}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )}

              {chartView === 'ytd' && (
                <div className="flex items-center gap-1 border rounded-lg px-1 h-8">
                  {([30, 60, 90] as TrendWindow[]).map((w) => (
                    <button
                      key={w}
                      onClick={() => setTrendWindow(w)}
                      className={cn(
                        "text-[10px] px-2 py-1 rounded transition-colors",
                        trendWindow === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {w}d
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Interactive Legend */}
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { key: 'revenue' as const, label: 'Revenue', color: COLORS.revenue, type: 'bar' },
                { key: 'cumulative' as const, label: 'Cumulative', color: COLORS.cumulative, type: 'line' },
                { key: 'forecast' as const, label: 'Forecast', color: COLORS.forecast, type: 'line' },
                { key: 'target' as const, label: 'Target', color: COLORS.target, type: 'dash' },
              ].map(({ key, label, color, type }) => (
                <button
                  key={key}
                  onClick={() => toggleSeries(key)}
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] transition-opacity cursor-pointer",
                    !visibleSeries[key] && "opacity-30"
                  )}
                >
                  {type === 'bar' ? (
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  ) : type === 'dash' ? (
                    <span className="w-4 h-[2px] border-t-2 border-dashed" style={{ borderColor: color }} />
                  ) : (
                    <span className="w-4 h-[2px] rounded" style={{ backgroundColor: color }} />
                  )}
                  <span className="text-muted-foreground">{label}</span>
                  {visibleSeries[key] ? (
                    <Eye className="h-2.5 w-2.5 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-2.5 w-2.5 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Main Chart */}
          <div className="bg-muted/20 border border-border rounded-xl p-3 md:p-5">
            <div className="h-[320px] md:h-[420px] lg:h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="projAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.cumulative} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={COLORS.cumulative} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="forecastAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.forecast} stopOpacity={0.12} />
                      <stop offset="100%" stopColor={COLORS.forecast} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="confBand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.forecast} stopOpacity={0.08} />
                      <stop offset="100%" stopColor={COLORS.forecast} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    interval={chartView === 'mtd' ? 2 : 0}
                  />
                  <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`}
                    width={50}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    tickFormatter={(v) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`}
                    width={55}
                  />

                  {/* Target reference line */}
                  {visibleSeries.target && (
                    <ReferenceLine
                      yAxisId="left"
                      y={chartData[0]?.target || 0}
                      stroke={COLORS.target}
                      strokeDasharray="8 4"
                      strokeWidth={1.5}
                      label={{ value: 'Target', position: 'insideTopRight', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    />
                  )}

                  {/* Milestone reference lines */}
                  {milestones.filter(m => m.hit).map((m) => (
                    <ReferenceLine
                      key={m.value}
                      yAxisId="right"
                      y={m.value}
                      stroke={COLORS.milestone}
                      strokeDasharray="4 4"
                      strokeWidth={0.5}
                      strokeOpacity={0.4}
                    />
                  ))}

                  {/* Confidence band */}
                  {visibleSeries.forecast && chartView === 'ytd' && (
                    <>
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="confidenceHigh"
                        stroke="transparent"
                        fill="url(#confBand)"
                        connectNulls={false}
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="confidenceLow"
                        stroke="transparent"
                        fill="transparent"
                        connectNulls={false}
                      />
                    </>
                  )}

                  {/* Cumulative area */}
                  {visibleSeries.cumulative && (
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulative"
                      stroke="transparent"
                      fill="url(#projAreaGrad)"
                      connectNulls={false}
                    />
                  )}

                  {/* Forecast area */}
                  {visibleSeries.forecast && (
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="forecastCumulative"
                      stroke="transparent"
                      fill="url(#forecastAreaGrad)"
                      connectNulls={false}
                    />
                  )}

                  {/* Revenue bars */}
                  {visibleSeries.revenue && (
                    <Bar
                      yAxisId="left"
                      dataKey="revenue"
                      fill={COLORS.revenue}
                      radius={[4, 4, 0, 0]}
                      opacity={0.85}
                      barSize={chartView === 'mtd' ? 8 : chartView === 'ytd' ? 22 : 14}
                      animationDuration={800}
                      animationBegin={0}
                    />
                  )}

                  {/* Forecast revenue bars */}
                  {visibleSeries.forecast && (
                    <Bar
                      yAxisId="left"
                      dataKey="forecastRevenue"
                      fill={COLORS.forecast}
                      radius={[4, 4, 0, 0]}
                      opacity={0.5}
                      barSize={chartView === 'mtd' ? 8 : chartView === 'ytd' ? 22 : 14}
                      animationDuration={800}
                      animationBegin={200}
                    />
                  )}

                  {/* Cumulative line */}
                  {visibleSeries.cumulative && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulative"
                      stroke={COLORS.cumulative}
                      strokeWidth={2.5}
                      dot={{ fill: COLORS.cumulative, strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, fill: COLORS.cumulative, stroke: 'rgba(255,128,0,0.3)', strokeWidth: 3 }}
                      connectNulls={false}
                      animationDuration={1000}
                    />
                  )}

                  {/* Forecast cumulative line */}
                  {visibleSeries.forecast && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="forecastCumulative"
                      stroke={COLORS.forecast}
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ fill: COLORS.forecast, strokeWidth: 0, r: 3 }}
                      connectNulls={false}
                      animationDuration={1200}
                      animationBegin={400}
                    />
                  )}

                  {/* Cumulative target line */}
                  {visibleSeries.target && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulativeTarget"
                      stroke="rgba(0,102,255,0.3)"
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                      dot={false}
                      connectNulls
                    />
                  )}

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      if (!d) return null;
                      const isForecast = d.forecastRevenue !== undefined && d.revenue === undefined;
                      return (
                        <div className="bg-card border border-border rounded-xl p-4 shadow-xl text-sm min-w-[200px]">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-foreground">{label}</p>
                            {isForecast && (
                              <Badge variant="outline" className="text-[10px] h-5" style={{ borderColor: COLORS.forecast, color: COLORS.forecast }}>
                                Projected
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {d.revenue !== undefined && (
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Revenue:</span>
                                <span className="font-semibold" style={{ color: COLORS.revenue }}>{formatCurrencyFull(d.revenue)}</span>
                              </div>
                            )}
                            {d.forecastRevenue !== undefined && (
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Projected:</span>
                                <span className="font-semibold" style={{ color: COLORS.forecast }}>{formatCurrencyFull(d.forecastRevenue)}</span>
                              </div>
                            )}
                            {d.cumulative !== undefined && (
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Cumulative:</span>
                                <span className="font-semibold" style={{ color: COLORS.cumulative }}>{formatCurrencyFull(d.cumulative)}</span>
                              </div>
                            )}
                            {d.forecastCumulative !== undefined && (
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Forecast Total:</span>
                                <span className="font-semibold" style={{ color: COLORS.forecast }}>{formatCurrencyFull(d.forecastCumulative)}</span>
                              </div>
                            )}
                            {d.deals !== undefined && (
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Deals:</span>
                                <span className="font-medium text-foreground">{d.deals}</span>
                              </div>
                            )}
                            {d.growth !== undefined && d.growth !== 0 && (
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Growth:</span>
                                <span className={cn("font-medium", d.growth >= 0 ? "text-emerald-600" : "text-red-500")}>
                                  {d.growth >= 0 ? '+' : ''}{d.growth}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Milestone Progress */}
          <div className="mt-6 flex items-center gap-1">
            {milestones.map((m, i) => (
              <div key={m.value} className="flex-1 flex flex-col items-center">
                <div className={cn(
                  "w-full h-2 rounded-full transition-all duration-500",
                  m.hit ? "bg-emerald-500" : "bg-muted",
                  i === 0 && "rounded-l-full",
                  i === milestones.length - 1 && "rounded-r-full",
                )} />
                <span className={cn(
                  "text-[9px] mt-1 font-medium",
                  m.hit ? "text-emerald-600" : "text-muted-foreground"
                )}>
                  {m.label}
                </span>
              </div>
            ))}
          </div>

          {/* Forecast Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/15">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Best Case</p>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(kpis.forecastBest)}</p>
              <p className="text-[10px] text-muted-foreground">110% of likely scenario</p>
            </div>
            <div className="p-4 rounded-xl border bg-purple-500/5 border-purple-500/15">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Likely</p>
              <p className="text-xl font-bold" style={{ color: COLORS.forecast }}>{formatCurrency(kpis.forecastLikely)}</p>
              <p className="text-[10px] text-muted-foreground">Linear + pipeline weighted</p>
            </div>
            <div className="p-4 rounded-xl border bg-red-500/5 border-red-500/15">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Conservative</p>
              <p className="text-xl font-bold text-red-500">{formatCurrency(kpis.forecastWorst)}</p>
              <p className="text-[10px] text-muted-foreground">80% of likely scenario</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
