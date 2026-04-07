import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Filter, ArrowUpRight, ArrowDownRight, AreaChart as AreaChartIcon, LineChart as LineChartIcon, BarChart3, Building2, User, CalendarDays, Clock, Target } from 'lucide-react';
import {
  ComposedChart, Area, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Customized,
} from 'recharts';
import {
  format, startOfMonth, startOfYear, startOfQuarter,
  subMonths, subYears, eachDayOfInterval, eachWeekOfInterval,
  eachMonthOfInterval, endOfDay, endOfWeek, endOfMonth,
} from 'date-fns';

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatCurrencyFull = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const ANNUAL_TARGET = 1500000;

type ChartType = 'area' | 'line' | 'bar';
type TimeRange = 'mtd' | 'qtd' | 'ytd' | '12m' | 'all';
type Granularity = 'daily' | 'weekly' | 'monthly';

interface RevenueChartProps {
  evanId: string | undefined;
}

const RevenueChart = ({ evanId }: RevenueChartProps) => {
  const [chartType, setChartType] = useState<ChartType>('area');
  const [timeRange, setTimeRange] = useState<TimeRange>('ytd');
  const [timeGranularity, setTimeGranularity] = useState<Granularity>('monthly');
  const [scope, setScope] = useState<'company' | 'personal'>('company');
  const [showTarget, setShowTarget] = useState(true);
  const [showPreviousPeriod, setShowPreviousPeriod] = useState(true);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const { data: revenueData, isLoading } = useQuery({
    queryKey: ['revenue-chart', evanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline')
        .select(`
          id,
          name,
          status,
          source,
          created_at,
          converted_at,
          assigned_to,
          lead_responses (
            loan_amount,
            funding_amount
          )
        `)
        .eq('status', 'funded');

      if (error) throw error;
      return data;
    },
  });

  // Extract unique sources for filter
  const allSources = useMemo(() => {
    if (!revenueData) return [];
    const sources = new Set(revenueData.map((d) => d.source).filter(Boolean) as string[]);
    return Array.from(sources).sort();
  }, [revenueData]);

  // Process chart data
  const { chartData, prevPeriodData, totalRevenue, totalDeals, avgDeal, prevTotalRevenue, prevTotalDeals, prevAvgDeal, goalDiffPct } = useMemo(() => {
    if (!revenueData) return { chartData: [], prevPeriodData: [], totalRevenue: 0, totalDeals: 0, avgDeal: 0, prevTotalRevenue: 0, prevTotalDeals: 0, prevAvgDeal: 0, goalDiffPct: null as number | null };

    const now = new Date();

    // Determine period boundaries
    let periodStart: Date;
    switch (timeRange) {
      case 'mtd': periodStart = startOfMonth(now); break;
      case 'qtd': periodStart = startOfQuarter(now); break;
      case 'ytd': periodStart = startOfYear(now); break;
      case '12m': periodStart = subMonths(now, 12); break;
      case 'all': periodStart = new Date(2020, 0, 1); break;
    }

    const periodDurationMs = now.getTime() - periodStart.getTime();
    const prevStart = new Date(periodStart.getTime() - periodDurationMs);
    const prevEnd = new Date(periodStart.getTime() - 1);

    // Filter leads
    const filterLeads = (leads: typeof revenueData, start: Date, end: Date) =>
      leads.filter((lead) => {
        if (!lead.converted_at) return false;
        const d = new Date(lead.converted_at);
        if (d < start || d > end) return false;
        if (scope === 'personal' && lead.assigned_to !== evanId) return false;
        if (selectedSources.length > 0 && !selectedSources.includes(lead.source || '')) return false;
        return true;
      });

    const currentLeads = filterLeads(revenueData, periodStart, now);
    const previousLeads = filterLeads(revenueData, prevStart, prevEnd);

    // Aggregate into buckets — filter out any that start before the period
    const getBuckets = (start: Date, end: Date): Date[] => {
      const safeEnd = end > now ? now : end;
      let raw: Date[];
      switch (timeGranularity) {
        case 'daily': raw = eachDayOfInterval({ start, end: safeEnd }); break;
        case 'weekly': raw = eachWeekOfInterval({ start, end: safeEnd }, { weekStartsOn: 1 }); break;
        case 'monthly': raw = eachMonthOfInterval({ start, end: safeEnd }); break;
      }
      return raw.filter((d) => d >= start);
    };

    const getBucketEnd = (bucketStart: Date): Date => {
      switch (timeGranularity) {
        case 'daily': return endOfDay(bucketStart);
        case 'weekly': return endOfWeek(bucketStart, { weekStartsOn: 1 });
        case 'monthly': return endOfMonth(bucketStart);
      }
    };

    const getLabelFormat = (): string => {
      const needsYear = timeRange === '12m' || timeRange === 'all';
      switch (timeGranularity) {
        case 'daily': return timeRange === 'mtd' ? 'd' : needsYear ? 'MMM d, yy' : 'MMM d';
        case 'weekly': return needsYear ? 'MMM d, yy' : 'MMM d';
        case 'monthly': return needsYear ? "MMM ''yy" : 'MMM';
      }
    };

    const buckets = getBuckets(periodStart, now);
    const labelFmt = getLabelFormat();
    // Goal: $1.5M annual target divided evenly across buckets in a full year
    const bucketsPerYear = timeGranularity === 'daily' ? 365 : timeGranularity === 'weekly' ? 52 : 12;
    const goalPerBucket = ANNUAL_TARGET / bucketsPerYear;

    const aggregate = (leads: typeof revenueData, bucketList: Date[]) =>
      bucketList.map((bStart) => {
        const bEnd = getBucketEnd(bStart);
        const bucketLeads = leads.filter((l) => {
          const d = new Date(l.converted_at!);
          return d >= bStart && d <= bEnd;
        });
        const revenue = bucketLeads.reduce(
          (sum, l) => sum + (l.lead_responses?.[0]?.loan_amount || 0) * 0.02, 0
        );
        return {
          label: format(bStart, labelFmt),
          revenue: Math.round(revenue),
          deals: bucketLeads.length,
        };
      });

    const currentData = aggregate(currentLeads, buckets);

    // Previous period data mapped to same bucket labels
    let prevData: typeof currentData = [];
    if (previousLeads.length > 0) {
      const prevBuckets = getBuckets(prevStart, prevEnd);
      const rawPrev = aggregate(previousLeads, prevBuckets);
      // Align to current labels
      prevData = currentData.map((_, i) => ({
        label: currentData[i].label,
        revenue: rawPrev[i]?.revenue || 0,
        deals: rawPrev[i]?.deals || 0,
      }));
    }

    // Merge into single dataset — all series are cumulative
    let cumulativeRevenue = 0;
    let cumulativePrev = 0;
    const merged = currentData.map((d, i) => {
      cumulativeRevenue += d.revenue;
      cumulativePrev += prevData[i]?.revenue || 0;
      return {
        label: d.label,
        revenue: cumulativeRevenue,
        ...(showTarget ? { goal: Math.round(goalPerBucket * (i + 1)) } : {}),
        ...(showPreviousPeriod ? { previous: cumulativePrev } : {}),
      };
    });

    const total = currentLeads.reduce(
      (sum, l) => sum + (l.lead_responses?.[0]?.loan_amount || 0) * 0.02, 0
    );
    const deals = currentLeads.length;

    const prevTotal = previousLeads.reduce(
      (sum, l) => sum + (l.lead_responses?.[0]?.loan_amount || 0) * 0.02, 0
    );
    const prevDeals = previousLeads.length;

    // % difference between current revenue and goal at the latest point
    const lastPoint = merged[merged.length - 1];
    const goalDiffPct = lastPoint?.goal && lastPoint.goal > 0
      ? Math.round(((lastPoint.revenue - lastPoint.goal) / lastPoint.goal) * 100)
      : null;

    return {
      chartData: merged,
      prevPeriodData: prevData,
      totalRevenue: total,
      totalDeals: deals,
      avgDeal: deals > 0 ? total / deals : 0,
      prevTotalRevenue: prevTotal,
      prevTotalDeals: prevDeals,
      prevAvgDeal: prevDeals > 0 ? prevTotal / prevDeals : 0,
      goalDiffPct,
    };
  }, [revenueData, timeRange, timeGranularity, scope, evanId, selectedSources, showTarget, showPreviousPeriod]);

  const toggleSource = (source: string) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const renderDelta = (current: number, previous: number) => {
    if (previous === 0 && current === 0) return null;
    if (previous === 0) return null;
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct === 0) return null;
    const isPositive = pct > 0;
    const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
    const color = isPositive ? 'text-emerald-600' : 'text-red-500';
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
        <Icon className="h-3 w-3" />
        {isPositive ? '+' : ''}{pct}%
      </span>
    );
  };

  const segmentClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
      active
        ? 'bg-white shadow-sm text-foreground ring-1 ring-black/5'
        : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
    }`;

  const chipClass = (active: boolean, activeColor = 'bg-primary/10 text-primary ring-1 ring-primary/20') =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
      active
        ? activeColor
        : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground ring-1 ring-transparent hover:ring-border'
    }`;

  const renderChart = () => {
    const commonProps = { data: chartData, margin: { top: 5, right: 10, left: 0, bottom: 0 } };
    // Auto-space ticks based on data density to prevent overlap
    const tickInterval = chartData.length <= 12 ? 0 : Math.ceil(chartData.length / 12) - 1;
    const xAxis = <XAxis dataKey="label" tick={{ fontSize: 12 }} className="text-muted-foreground" interval={tickInterval} />;
    const yAxis = <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" tickFormatter={formatCurrency} width={55} />;
    const grid = <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />;
    const tooltip = (
      <Tooltip
        formatter={(value: number) => [formatCurrencyFull(value)]}
        contentStyle={{ borderRadius: '8px', fontSize: '13px', border: '1px solid hsl(var(--border))' }}
      />
    );
    const legend = <Legend iconType={chartType === 'bar' ? 'rect' : 'line'} wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />;

    // Render using ComposedChart so Area, Line, and Bar all work together
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart {...commonProps}>
          <defs>
            <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.25} />
            </linearGradient>
            <linearGradient id="prevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          {legend}
          {showPreviousPeriod && (
            chartType === 'bar'
              ? <Bar dataKey="previous" name="Previous Period" fill="#a78bfa" opacity={0.3} radius={[4, 4, 0, 0]} />
              : chartType === 'line'
                ? <Line type="monotone" dataKey="previous" name="Previous Period" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                : <Area type="monotone" dataKey="previous" name="Previous Period" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#prevGradient)" />
          )}
          {chartType === 'bar'
            ? <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            : chartType === 'line'
              ? <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
              : <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGradient)" />
          }
          {showTarget && (
            chartType === 'bar'
              ? <Bar dataKey="goal" name="$1.5M Goal" fill="#f59e0b" opacity={0.4} radius={[4, 4, 0, 0]} />
              : <Line type="monotone" dataKey="goal" name="$1.5M Goal" stroke="#f59e0b" strokeWidth={2} dot={false} />
          )}
          {showTarget && chartType !== 'bar' && chartData.length > 1 && (
            <Customized
              component={(props: any) => {
                const { xAxisMap, yAxisMap } = props;
                const xAxis = xAxisMap && Object.values(xAxisMap)[0] as any;
                const yAxis = yAxisMap && Object.values(yAxisMap)[0] as any;
                if (!xAxis?.scale || !yAxis?.scale) return null;

                // Build pixel coordinates for revenue and goal lines
                const points = chartData.map((d) => {
                  const x = xAxis.scale(d.label) + (xAxis.bandwidth ? xAxis.bandwidth() / 2 : 0);
                  const revY = yAxis.scale(d.revenue);
                  const goalY = yAxis.scale(d.goal || 0);
                  return { x, revY, goalY, revenue: d.revenue, goal: d.goal || 0 };
                });

                // Build segments between consecutive points, colored by whether revenue > goal
                const segments: JSX.Element[] = [];
                for (let i = 0; i < points.length - 1; i++) {
                  const p1 = points[i];
                  const p2 = points[i + 1];
                  // Use the average comparison to determine color for this segment
                  const avgRevenue = (p1.revenue + p2.revenue) / 2;
                  const avgGoal = (p1.goal + p2.goal) / 2;
                  const isAhead = avgRevenue >= avgGoal;

                  // Polygon: revenue line top-to-bottom, then goal line bottom-to-top
                  const polygonPoints = `${p1.x},${p1.revY} ${p2.x},${p2.revY} ${p2.x},${p2.goalY} ${p1.x},${p1.goalY}`;
                  segments.push(
                    <polygon
                      key={`gap-${i}`}
                      points={polygonPoints}
                      fill={isAhead ? '#059669' : '#dc2626'}
                      opacity={0.12}
                    />
                  );
                }

                return (
                  <g>
                    {segments}
                  </g>
                );
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3 space-y-3">
        {/* Row 1: Title + Chart type toggle */}
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Revenue</CardTitle>
            <CardDescription>Cumulative performance over time</CardDescription>
          </div>
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 ring-1 ring-border/50">
            <button onClick={() => setChartType('area')} className={segmentClass(chartType === 'area')}>
              <AreaChartIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Area</span>
            </button>
            <button onClick={() => setChartType('line')} className={segmentClass(chartType === 'line')}>
              <LineChartIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Line</span>
            </button>
            <button onClick={() => setChartType('bar')} className={segmentClass(chartType === 'bar')}>
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bar</span>
            </button>
          </div>
        </div>

        {/* Row 2: Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope */}
          <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 ring-1 ring-border/50">
            <button onClick={() => setScope('company')} className={segmentClass(scope === 'company')}>
              <Building2 className="h-3.5 w-3.5" />
              Company
            </button>
            <button onClick={() => setScope('personal')} className={segmentClass(scope === 'personal')}>
              <User className="h-3.5 w-3.5" />
              My Deals
            </button>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-border/60" />

          {/* Time range */}
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex items-center gap-0.5">
              {([
                ['mtd', 'MTD'],
                ['qtd', 'QTD'],
                ['ytd', 'YTD'],
                ['12m', '12M'],
                ['all', 'All'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTimeRange(value)}
                  className={chipClass(timeRange === value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-border/60" />

          {/* Granularity */}
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex items-center gap-0.5">
              {([
                ['daily', 'Day'],
                ['weekly', 'Week'],
                ['monthly', 'Month'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTimeGranularity(value)}
                  className={chipClass(timeGranularity === value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Source filter */}
          {allSources.length > 0 && (<>
            <div className="h-5 w-px bg-border/60" />
            <Popover>
              <PopoverTrigger asChild>
                <button className={`flex items-center gap-1.5 ${chipClass(selectedSources.length > 0, 'bg-primary/10 text-primary ring-1 ring-primary/20')}`}>
                  <Filter className="h-3.5 w-3.5" />
                  {selectedSources.length === 0 ? 'All Sources' : `${selectedSources.length} source${selectedSources.length > 1 ? 's' : ''}`}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-3" align="start">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium">Filter by Source</p>
                  <button
                    onClick={() => setSelectedSources([])}
                    className="text-xs text-primary hover:underline"
                  >
                    {selectedSources.length > 0 ? 'Clear' : ''}
                  </button>
                </div>
                <div className="space-y-1">
                  {allSources.map((source) => (
                    <label key={source} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors">
                      <Checkbox
                        checked={selectedSources.includes(source)}
                        onCheckedChange={() => toggleSource(source)}
                      />
                      <span className="text-xs capitalize">{source}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </>)}
        </div>

        {/* Row 3: Overlay toggles */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-0.5">Overlays</span>
          <button
            onClick={() => setShowTarget(!showTarget)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showTarget
                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 shadow-sm'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 ring-1 ring-transparent hover:ring-border'
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            $1.5M Goal
          </button>
          <button
            onClick={() => setShowPreviousPeriod(!showPreviousPeriod)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showPreviousPeriod
                ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-200 shadow-sm'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 ring-1 ring-transparent hover:ring-border'
            }`}
          >
            <ArrowDownRight className="h-3.5 w-3.5" />
            vs Previous
          </button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-6 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
              {renderDelta(totalRevenue, prevTotalRevenue)}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Deals</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold">{totalDeals}</p>
              {renderDelta(totalDeals, prevTotalDeals)}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Deal</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold">{formatCurrency(avgDeal)}</p>
              {renderDelta(avgDeal, prevAvgDeal)}
            </div>
          </div>
        </div>

        <div className="h-[350px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length > 0 ? (
            renderChart()
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No revenue data for this period
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueChart;
