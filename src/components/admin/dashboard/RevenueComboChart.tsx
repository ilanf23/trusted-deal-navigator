import { useState, useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  Filter,
  Building2,
  User,
  CalendarDays,
  Target,
  ArrowDownRight,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export type TimeRange = 'mtd' | 'qtd' | 'ytd' | '12m' | 'all';
export type Scope = 'company' | 'personal';

export interface ComboChartDataPoint {
  label: string;
  revenue: number;
  cumulative: number;
  target?: number;
  previous?: number;
}

export interface QuarterlyTarget {
  label: string;
  value: number;
}

export interface RevenueComboChartProps {
  data: ComboChartDataPoint[];
  isLoading?: boolean;
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
  scope?: Scope;
  onScopeChange?: (scope: Scope) => void;
  sources?: string[];
  selectedSources?: string[];
  onSourcesChange?: (sources: string[]) => void;
  quarterlyTargets?: QuarterlyTarget[];
  onPeriodClick?: (label: string, index: number) => void;
  showScopeToggle?: boolean;
  showSourceFilter?: boolean;
  title?: string;
  description?: string;
  className?: string;
}

const LIGHT_COLORS = {
  bar: '#6366f1',
  cumulative: '#0f172a',
  target: '#f59e0b',
  previous: '#60a5fa',
  grid: '#e5e7eb',
  axis: '#9ca3af',
  refLine: '#e879797a',
};

const DARK_COLORS = {
  bar: '#818cf8',
  cumulative: '#e2e8f0',
  target: '#fbbf24',
  previous: '#93c5fd',
  grid: '#334155',
  axis: '#94a3b8',
  refLine: '#f87171aa',
};

function useChartColors() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatCurrencyFull = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const seriesLabels: Record<string, string> = {
    revenue: 'Period Revenue',
    cumulative: 'Cumulative',
    target: 'Target Pace',
    previous: 'Previous Period',
  };

  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">
                {seriesLabels[entry.dataKey] || entry.name}
              </span>
            </div>
            <span className="font-mono font-medium tabular-nums text-foreground">
              {formatCurrencyFull(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactLegend({
  payload,
}: {
  payload?: Array<{ value: string; color: string; dataKey?: string }>;
}) {
  if (!payload?.length) return null;

  const seriesLabels: Record<string, string> = {
    revenue: 'Period Revenue',
    cumulative: 'Cumulative',
    target: 'Target Pace',
    previous: 'Previous Period',
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3 text-xs">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 shrink-0 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">
            {seriesLabels[entry.dataKey ?? entry.value] || entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RevenueComboChart({
  data,
  isLoading = false,
  timeRange: controlledTimeRange,
  onTimeRangeChange,
  scope: controlledScope,
  onScopeChange,
  sources = [],
  selectedSources: controlledSelectedSources,
  onSourcesChange,
  quarterlyTargets = [],
  onPeriodClick,
  showScopeToggle = true,
  showSourceFilter = true,
  title = 'Revenue',
  description = 'Period revenue with cumulative trend',
  className,
}: RevenueComboChartProps) {
  const [internalTimeRange, setInternalTimeRange] = useState<TimeRange>('ytd');
  const [internalScope, setInternalScope] = useState<Scope>('company');
  const [internalSelectedSources, setInternalSelectedSources] = useState<string[]>([]);
  const [showTarget, setShowTarget] = useState(true);
  const [showPrevious, setShowPrevious] = useState(true);
  const COLORS = useChartColors();

  const timeRange = controlledTimeRange ?? internalTimeRange;
  const scope = controlledScope ?? internalScope;
  const selectedSourcesList = controlledSelectedSources ?? internalSelectedSources;

  const handleTimeRangeChange = useCallback(
    (range: TimeRange) => {
      if (onTimeRangeChange) onTimeRangeChange(range);
      else setInternalTimeRange(range);
    },
    [onTimeRangeChange],
  );

  const handleScopeChange = useCallback(
    (s: Scope) => {
      if (onScopeChange) onScopeChange(s);
      else setInternalScope(s);
    },
    [onScopeChange],
  );

  const toggleSource = useCallback(
    (source: string) => {
      const next = selectedSourcesList.includes(source)
        ? selectedSourcesList.filter((s) => s !== source)
        : [...selectedSourcesList, source];
      if (onSourcesChange) onSourcesChange(next);
      else setInternalSelectedSources(next);
    },
    [selectedSourcesList, onSourcesChange],
  );

  const clearSources = useCallback(() => {
    if (onSourcesChange) onSourcesChange([]);
    else setInternalSelectedSources([]);
  }, [onSourcesChange]);

  const hasTarget = useMemo(() => data.some((d) => d.target != null), [data]);
  const hasPrevious = useMemo(() => data.some((d) => d.previous != null), [data]);

  const filteredData = useMemo(() => {
    if (showTarget && showPrevious) return data;
    return data.map((d) => ({
      ...d,
      target: showTarget ? d.target : undefined,
      previous: showPrevious ? d.previous : undefined,
    }));
  }, [data, showTarget, showPrevious]);

  const handleBarClick = useCallback(
    (_: unknown, index: number) => {
      if (onPeriodClick && filteredData[index]) {
        onPeriodClick(filteredData[index].label, index);
      }
    },
    [onPeriodClick, filteredData],
  );

  const tickInterval = useMemo(
    () => (filteredData.length <= 12 ? 0 : Math.ceil(filteredData.length / 12) - 1),
    [filteredData],
  );

  const segmentClass = (active: boolean) =>
    cn(
      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
      active
        ? 'bg-white shadow-sm text-foreground ring-1 ring-black/5 dark:bg-muted dark:ring-border'
        : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-muted/50',
    );

  const chipClass = (active: boolean, activeColor?: string) =>
    cn(
      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
      active
        ? activeColor || 'bg-primary/10 text-primary ring-1 ring-primary/20'
        : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 hover:text-foreground ring-1 ring-transparent hover:ring-border',
    );

  return (
    <Card className={className}>
      <CardHeader className="pb-3 space-y-3">
        <div>
          <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {showScopeToggle && (
            <>
              <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 ring-1 ring-border/50">
                <button
                  onClick={() => handleScopeChange('company')}
                  className={segmentClass(scope === 'company')}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Company
                </button>
                <button
                  onClick={() => handleScopeChange('personal')}
                  className={segmentClass(scope === 'personal')}
                >
                  <User className="h-3.5 w-3.5" />
                  My Deals
                </button>
              </div>
              <div className="h-5 w-px bg-border/60" />
            </>
          )}

          <div className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex items-center gap-0.5">
              {(
                [
                  ['mtd', 'MTD'],
                  ['qtd', 'QTD'],
                  ['ytd', 'YTD'],
                  ['12m', '12M'],
                  ['all', 'All'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => handleTimeRangeChange(value)}
                  className={chipClass(timeRange === value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {showSourceFilter && sources.length > 0 && (
            <>
              <div className="h-5 w-px bg-border/60" />
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      'flex items-center gap-1.5',
                      chipClass(
                        selectedSourcesList.length > 0,
                        'bg-primary/10 text-primary ring-1 ring-primary/20',
                      ),
                    )}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {selectedSourcesList.length === 0
                      ? 'All Sources'
                      : `${selectedSourcesList.length} source${selectedSourcesList.length > 1 ? 's' : ''}`}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-3" align="start">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium">Filter by Source</p>
                    {selectedSourcesList.length > 0 && (
                      <button
                        onClick={clearSources}
                        className="text-xs text-primary hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {sources.map((source) => (
                      <label
                        key={source}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedSourcesList.includes(source)}
                          onCheckedChange={() => toggleSource(source)}
                        />
                        <span className="text-xs capitalize">{source}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>

        {(hasTarget || hasPrevious) && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-0.5">Overlays</span>
            {hasTarget && (
              <button
                onClick={() => setShowTarget(!showTarget)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  showTarget
                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 shadow-sm dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 ring-1 ring-transparent hover:ring-border',
                )}
              >
                <Target className="h-3.5 w-3.5" />
                Target
              </button>
            )}
            {hasPrevious && (
              <button
                onClick={() => setShowPrevious(!showPrevious)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  showPrevious
                    ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-200 shadow-sm dark:bg-purple-950/40 dark:text-purple-400 dark:ring-purple-800'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/80 ring-1 ring-transparent hover:ring-border',
                )}
              >
                <ArrowDownRight className="h-3.5 w-3.5" />
                vs Previous
              </button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="h-[380px]">
          {isLoading ? (
            <div className="flex flex-col gap-3 h-full pt-4 px-2">
              <div className="flex items-end gap-2 h-full">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="flex-1 rounded-t-sm"
                    style={{ height: `${30 + Math.random() * 55}%` }}
                  />
                ))}
              </div>
              <Skeleton className="h-4 w-full" />
            </div>
          ) : filteredData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={filteredData}
                margin={{ top: 12, right: 24, left: 4, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={COLORS.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  axisLine={{ stroke: COLORS.grid, strokeWidth: 1 }}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: COLORS.axis }}
                  interval={tickInterval}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: COLORS.axis }}
                  tickFormatter={formatCurrency}
                  tickCount={5}
                  width={55}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CompactLegend />} />

                {quarterlyTargets.map((qt) => (
                  <ReferenceLine
                    key={qt.label}
                    y={qt.value}
                    yAxisId="left"
                    stroke={COLORS.refLine}
                    strokeDasharray="6 4"
                    label={{
                      value: `${qt.label}: ${formatCurrency(qt.value)}`,
                      position: 'insideTopRight',
                      fill: COLORS.axis,
                      fontSize: 10,
                    }}
                  />
                ))}

                <Bar
                  yAxisId="left"
                  dataKey="revenue"
                  name="Period Revenue"
                  fill={COLORS.bar}
                  opacity={0.7}
                  radius={[3, 3, 0, 0]}
                  onClick={handleBarClick}
                  cursor={onPeriodClick ? 'pointer' : undefined}
                />

                {showPrevious && hasPrevious && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="previous"
                    name="Previous Period"
                    stroke={COLORS.previous}
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    dot={false}
                    activeDot={{ r: 4, fill: COLORS.previous, stroke: '#fff', strokeWidth: 2 }}
                  />
                )}

                {showTarget && hasTarget && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="target"
                    name="Target Pace"
                    stroke={COLORS.target}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 4, fill: COLORS.target, stroke: '#fff', strokeWidth: 2 }}
                  />
                )}

                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative"
                  stroke={COLORS.cumulative}
                  strokeWidth={2.25}
                  dot={{ r: 3, fill: COLORS.cumulative, stroke: '#fff', strokeWidth: 1 }}
                  activeDot={{ r: 5, fill: COLORS.cumulative, stroke: '#fff', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No revenue data for this period
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
