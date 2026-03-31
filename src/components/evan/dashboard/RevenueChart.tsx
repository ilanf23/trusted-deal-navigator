import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Filter } from 'lucide-react';
import {
  AreaChart, Area,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
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
  const [showPreviousPeriod, setShowPreviousPeriod] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const { data: revenueData, isLoading } = useQuery({
    queryKey: ['evan-revenue-chart', evanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
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
  const { chartData, prevPeriodData, totalRevenue, totalDeals, avgDeal } = useMemo(() => {
    if (!revenueData) return { chartData: [], prevPeriodData: [], totalRevenue: 0, totalDeals: 0, avgDeal: 0 };

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
    const previousLeads = showPreviousPeriod ? filterLeads(revenueData, prevStart, prevEnd) : [];

    // Aggregate into buckets
    const getBuckets = (start: Date, end: Date): Date[] => {
      const safeEnd = end > now ? now : end;
      switch (timeGranularity) {
        case 'daily': return eachDayOfInterval({ start, end: safeEnd });
        case 'weekly': return eachWeekOfInterval({ start, end: safeEnd }, { weekStartsOn: 1 });
        case 'monthly': return eachMonthOfInterval({ start, end: safeEnd });
      }
    };

    const getBucketEnd = (bucketStart: Date): Date => {
      switch (timeGranularity) {
        case 'daily': return endOfDay(bucketStart);
        case 'weekly': return endOfWeek(bucketStart, { weekStartsOn: 1 });
        case 'monthly': return endOfMonth(bucketStart);
      }
    };

    const getLabelFormat = (): string => {
      switch (timeGranularity) {
        case 'daily': return timeRange === 'mtd' ? 'd' : 'MMM d';
        case 'weekly': return 'MMM d';
        case 'monthly': return 'MMM';
      }
    };

    const buckets = getBuckets(periodStart, now);
    const labelFmt = getLabelFormat();
    const targetPerBucket = buckets.length > 0 ? ANNUAL_TARGET * 0.02 / (timeRange === 'ytd' ? 12 : buckets.length) : 0;

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
    if (showPreviousPeriod && previousLeads.length > 0) {
      const prevBuckets = getBuckets(prevStart, prevEnd);
      const rawPrev = aggregate(previousLeads, prevBuckets);
      // Align to current labels
      prevData = currentData.map((_, i) => ({
        label: currentData[i].label,
        revenue: rawPrev[i]?.revenue || 0,
        deals: rawPrev[i]?.deals || 0,
      }));
    }

    // Merge into single dataset
    const merged = currentData.map((d, i) => ({
      label: d.label,
      revenue: d.revenue,
      ...(showTarget ? { target: Math.round(targetPerBucket) } : {}),
      ...(showPreviousPeriod ? { previous: prevData[i]?.revenue || 0 } : {}),
    }));

    const total = currentLeads.reduce(
      (sum, l) => sum + (l.lead_responses?.[0]?.loan_amount || 0) * 0.02, 0
    );
    const deals = currentLeads.length;

    return {
      chartData: merged,
      prevPeriodData: prevData,
      totalRevenue: total,
      totalDeals: deals,
      avgDeal: deals > 0 ? total / deals : 0,
    };
  }, [revenueData, timeRange, timeGranularity, scope, evanId, selectedSources, showTarget, showPreviousPeriod]);

  const toggleSource = (source: string) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const pillClass = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs font-medium transition-all ${active ? 'bg-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`;

  const renderChart = () => {
    const commonProps = { data: chartData, margin: { top: 5, right: 10, left: 0, bottom: 0 } };
    const xAxis = <XAxis dataKey="label" tick={{ fontSize: 12 }} className="text-muted-foreground" />;
    const yAxis = <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" tickFormatter={formatCurrency} width={55} />;
    const grid = <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />;
    const tooltip = (
      <Tooltip
        formatter={(value: number, name: string) => [
          formatCurrencyFull(value),
          name === 'revenue' ? 'Revenue' : name === 'target' ? 'Target' : 'Previous',
        ]}
        contentStyle={{ borderRadius: '8px', fontSize: '13px', border: '1px solid hsl(var(--border))' }}
      />
    );

    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart {...commonProps}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            {showPreviousPeriod && (
              <Bar dataKey="previous" fill="#a78bfa" opacity={0.3} radius={[4, 4, 0, 0]} />
            )}
            <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            {showTarget && (
              <ReferenceLine y={chartData[0]?.target || 0} stroke="#9ca3af" strokeDasharray="6 4" strokeWidth={1.5} />
            )}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart {...commonProps}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            {showPreviousPeriod && (
              <Line type="monotone" dataKey="previous" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            )}
            <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
            {showTarget && (
              <ReferenceLine y={chartData[0]?.target || 0} stroke="#9ca3af" strokeDasharray="6 4" strokeWidth={1.5} />
            )}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Default: area
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart {...commonProps}>
          <defs>
            <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
          {showPreviousPeriod && (
            <Area type="monotone" dataKey="previous" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#prevGradient)" />
          )}
          <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGradient)" />
          {showTarget && (
            <ReferenceLine y={chartData[0]?.target || 0} stroke="#9ca3af" strokeDasharray="6 4" strokeWidth={1.5} />
          )}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base">Revenue</CardTitle>
            <CardDescription>Track performance over time</CardDescription>
          </div>

          <div className="flex items-center gap-1 bg-muted/60 rounded-full p-1">
            <button onClick={() => setChartType('area')} className={pillClass(chartType === 'area')}>Area</button>
            <button onClick={() => setChartType('line')} className={pillClass(chartType === 'line')}>Line</button>
            <button onClick={() => setChartType('bar')} className={pillClass(chartType === 'bar')}>Bar</button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-2">
          <div className="flex items-center gap-1 bg-muted/60 rounded-full p-1">
            <button onClick={() => setScope('company')} className={pillClass(scope === 'company')}>Company</button>
            <button onClick={() => setScope('personal')} className={pillClass(scope === 'personal')}>My Deals</button>
          </div>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="bg-muted/60 text-xs font-medium px-3 py-1.5 rounded-full border-0 outline-none cursor-pointer"
          >
            <option value="mtd">This Month</option>
            <option value="qtd">This Quarter</option>
            <option value="ytd">This Year</option>
            <option value="12m">Last 12 Months</option>
            <option value="all">All Time</option>
          </select>

          <select
            value={timeGranularity}
            onChange={(e) => setTimeGranularity(e.target.value as Granularity)}
            className="bg-muted/60 text-xs font-medium px-3 py-1.5 rounded-full border-0 outline-none cursor-pointer"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

          {allSources.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 bg-muted/60 text-xs font-medium px-3 py-1.5 rounded-full border-0 outline-none cursor-pointer">
                  <Filter className="h-3 w-3" />
                  {selectedSources.length === 0 ? 'All Sources' : `${selectedSources.length} source${selectedSources.length > 1 ? 's' : ''}`}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <button
                  onClick={() => setSelectedSources([])}
                  className="text-xs text-muted-foreground hover:text-foreground mb-2 px-2"
                >
                  {selectedSources.length > 0 ? 'Clear all' : 'Showing all'}
                </button>
                <div className="space-y-1.5">
                  {allSources.map((source) => (
                    <label key={source} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer">
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
          )}

          <div className="flex-1" />

          <button
            onClick={() => setShowTarget(!showTarget)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${showTarget ? 'bg-blue-100 text-blue-700' : 'bg-muted/60 text-muted-foreground'}`}
          >
            Target Line
          </button>
          <button
            onClick={() => setShowPreviousPeriod(!showPreviousPeriod)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${showPreviousPeriod ? 'bg-purple-100 text-purple-700' : 'bg-muted/60 text-muted-foreground'}`}
          >
            vs Previous
          </button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center gap-6 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Deals</p>
            <p className="text-xl font-bold">{totalDeals}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Deal</p>
            <p className="text-xl font-bold">{formatCurrency(avgDeal)}</p>
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
