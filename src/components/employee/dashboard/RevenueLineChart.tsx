import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Filter, Building2, User, CalendarDays } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { TimeRange, Scope } from '@/components/admin/dashboard/RevenueComboChart';

export interface LineChartDataPoint {
  date: Date;
  cumulative: number;
  label: string;
  goal?: number;
}

export interface RevenueLineChartProps {
  data: LineChartDataPoint[];
  isLoading?: boolean;
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
  scope?: Scope;
  onScopeChange?: (scope: Scope) => void;
  sources?: string[];
  selectedSources?: string[];
  onSourcesChange?: (sources: string[]) => void;
  showScopeToggle?: boolean;
  showSourceFilter?: boolean;
  title?: string;
  description?: string;
  seriesLabel?: string;
  annualGoal?: number;
  className?: string;
}

const MARGIN_TOP = 28;
const MARGIN_RIGHT = 88;
const MARGIN_BOTTOM = 32;
const MARGIN_LEFT = 64;
const CHART_HEIGHT = 420;

const formatLabel = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
};

const formatTooltipCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export function RevenueLineChart({
  data,
  isLoading = false,
  timeRange: controlledTimeRange,
  onTimeRangeChange,
  scope: controlledScope,
  onScopeChange,
  sources = [],
  selectedSources: controlledSelectedSources,
  onSourcesChange,
  showScopeToggle = true,
  showSourceFilter = true,
  title = 'Revenue',
  description = 'Cumulative revenue vs. annual pace',
  seriesLabel = 'Revenue',
  annualGoal,
  className,
}: RevenueLineChartProps) {
  const [internalTimeRange, setInternalTimeRange] = useState<TimeRange>('ytd');
  const [internalScope, setInternalScope] = useState<Scope>('company');
  const [internalSelectedSources, setInternalSelectedSources] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dims, setDims] = useState<{ width: number; height: number }>({
    width: 0,
    height: CHART_HEIGHT,
  });
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    point: LineChartDataPoint;
  } | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const timeRange = controlledTimeRange ?? internalTimeRange;
  const scope = controlledScope ?? internalScope;
  const selectedSourcesList = controlledSelectedSources ?? internalSelectedSources;

  const hasGoalSeries = useMemo(() => data.some((d) => typeof d.goal === 'number'), [data]);

  // Brand-aligned palette: indigo for revenue, amber for goal pace.
  // Same colors are used in the SVG and the header legend so they always match.
  const revenueColor = isDark ? '#a5b4fc' : '#4f46e5';
  const goalColor = isDark ? '#fbbf24' : '#d97706';

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

  // Track the actual rendered container width so the SVG fills its slot.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setDims((prev) => (prev.width === w ? prev : { ...prev, width: w }));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || data.length === 0 || dims.width === 0) return;

    const width = dims.width;
    const height = dims.height;

    const gridColor = isDark ? '#1e293b' : '#eef2f7';
    const axisTextColor = isDark ? '#94a3b8' : '#64748b';
    const haloColor = isDark ? '#0b1120' : '#ffffff';
    const hasGoal = data.some((d) => typeof d.goal === 'number');

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    // Defs: gradient under the revenue line for visual emphasis.
    const gradId = `rev-grad-${isDark ? 'd' : 'l'}`;
    const defs = svg.append('defs');
    const grad = defs
      .append('linearGradient')
      .attr('id', gradId)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', 1);
    grad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', revenueColor)
      .attr('stop-opacity', isDark ? 0.32 : 0.22);
    grad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', revenueColor)
      .attr('stop-opacity', 0);

    const x = d3
      .scaleUtc()
      .domain([data[0].date, data[data.length - 1].date])
      .range([MARGIN_LEFT, width - MARGIN_RIGHT]);

    const yMaxCumulative = d3.max(data, (d) => d.cumulative) ?? 0;
    const yMaxGoal = hasGoal ? (d3.max(data, (d) => d.goal ?? 0) ?? 0) : 0;
    const yMaxRaw = Math.max(yMaxCumulative, yMaxGoal, 1);
    const y = d3
      .scaleLinear()
      .domain([0, yMaxRaw])
      .nice(5)
      .range([height - MARGIN_BOTTOM, MARGIN_TOP]);

    // Horizontal gridlines (subtle, low contrast — don't compete with data).
    const yTicks = y.ticks(5);
    svg
      .append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', MARGIN_LEFT)
      .attr('x2', width - MARGIN_RIGHT)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', gridColor)
      .attr('stroke-width', 1)
      .attr('shape-rendering', 'crispEdges');

    // Y-axis: currency-formatted ticks, no axis line (gridlines do the work).
    const yAxisGroup = svg
      .append('g')
      .attr('transform', `translate(${MARGIN_LEFT},0)`)
      .call(
        d3
          .axisLeft(y)
          .tickValues(yTicks)
          .tickSize(0)
          .tickPadding(10)
          .tickFormat((d) => formatLabel(d as number)),
      );
    yAxisGroup.select('.domain').remove();
    yAxisGroup
      .selectAll('text')
      .attr('fill', axisTextColor)
      .style('font-size', '11px')
      .style('font-variant-numeric', 'tabular-nums');

    // X-axis: clean ticks, no domain stroke.
    const xAxisGroup = svg
      .append('g')
      .attr('transform', `translate(0,${height - MARGIN_BOTTOM})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(Math.max(2, Math.floor(width / 110)))
          .tickSizeOuter(0)
          .tickSize(0)
          .tickPadding(10),
      );
    xAxisGroup.select('.domain').remove();
    xAxisGroup
      .selectAll('text')
      .attr('fill', axisTextColor)
      .style('font-size', '11px');

    // Gradient area under the revenue line.
    const areaGen = d3
      .area<LineChartDataPoint>()
      .curve(d3.curveMonotoneX)
      .x((d) => x(d.date))
      .y0(y(0))
      .y1((d) => y(d.cumulative));

    svg
      .append('path')
      .datum(data)
      .attr('fill', `url(#${gradId})`)
      .attr('d', areaGen);

    // Goal line (drawn before revenue so revenue sits on top).
    if (hasGoal) {
      const goalPoints = data.filter((d) => typeof d.goal === 'number') as Array<
        LineChartDataPoint & { goal: number }
      >;
      if (goalPoints.length > 0) {
        svg
          .append('path')
          .datum(goalPoints)
          .attr('fill', 'none')
          .attr('stroke', goalColor)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '6 5')
          .attr('stroke-linecap', 'round')
          .attr(
            'd',
            d3
              .line<typeof goalPoints[number]>()
              .curve(d3.curveMonotoneX)
              .x((d) => x(d.date))
              .y((d) => y(d.goal))(goalPoints)!,
          );

        // End-of-line goal badge — placed in the right margin so it never
        // overlaps with the revenue terminal value.
        const lastGoal = goalPoints[goalPoints.length - 1];
        const gx = x(lastGoal.date);
        const gy = y(lastGoal.goal);
        const goalBadgeText = formatLabel(lastGoal.goal);
        const goalBadgeWidth = Math.max(48, goalBadgeText.length * 7 + 14);
        const goalBadge = svg
          .append('g')
          .attr('transform', `translate(${Math.min(gx + 10, width - MARGIN_RIGHT + 6)},${gy})`);
        goalBadge
          .append('rect')
          .attr('x', 0)
          .attr('y', -9)
          .attr('width', goalBadgeWidth)
          .attr('height', 18)
          .attr('rx', 9)
          .attr('fill', goalColor)
          .attr('opacity', 0.95);
        goalBadge
          .append('text')
          .attr('x', goalBadgeWidth / 2)
          .attr('y', 0)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'middle')
          .attr('fill', '#ffffff')
          .attr('font-weight', 600)
          .attr('font-size', 11)
          .style('font-variant-numeric', 'tabular-nums')
          .text(goalBadgeText);
      }
    }

    // Revenue line (smooth curve, brand-colored, sits on top).
    const lineGen = d3
      .line<LineChartDataPoint>()
      .curve(d3.curveMonotoneX)
      .x((d) => x(d.date))
      .y((d) => y(d.cumulative));

    svg
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', revenueColor)
      .attr('stroke-width', 2.5)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('d', lineGen);

    // Final point: dot + value badge centered above the dot.
    const last = data[data.length - 1];
    const lx = x(last.date);
    const ly = y(last.cumulative);

    svg
      .append('circle')
      .attr('cx', lx)
      .attr('cy', ly)
      .attr('r', 4.5)
      .attr('fill', revenueColor)
      .attr('stroke', haloColor)
      .attr('stroke-width', 2);

    const revBadgeText = formatLabel(last.cumulative);
    const revBadgeWidth = Math.max(54, revBadgeText.length * 7 + 14);
    // Offset above the point; clamp horizontally so it stays within the plot area.
    const badgeCenterX = Math.min(
      Math.max(lx, MARGIN_LEFT + revBadgeWidth / 2),
      width - MARGIN_RIGHT - revBadgeWidth / 2,
    );
    const revBadge = svg
      .append('g')
      .attr('transform', `translate(${badgeCenterX - revBadgeWidth / 2},${ly - 22})`);
    revBadge
      .append('rect')
      .attr('x', 0)
      .attr('y', -9)
      .attr('width', revBadgeWidth)
      .attr('height', 18)
      .attr('rx', 9)
      .attr('fill', revenueColor);
    revBadge
      .append('text')
      .attr('x', revBadgeWidth / 2)
      .attr('y', 0)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-weight', 600)
      .attr('font-size', 11)
      .style('font-variant-numeric', 'tabular-nums')
      .text(revBadgeText);

    // Hover layer ---------------------------------------------------------
    const hoverGroup = svg
      .append('g')
      .attr('pointer-events', 'none')
      .style('display', 'none');

    hoverGroup
      .append('line')
      .attr('class', 'hover-rule')
      .attr('y1', MARGIN_TOP)
      .attr('y2', height - MARGIN_BOTTOM)
      .attr('stroke', axisTextColor)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3');

    hoverGroup
      .append('circle')
      .attr('class', 'hover-dot')
      .attr('r', 4.5)
      .attr('fill', revenueColor)
      .attr('stroke', haloColor)
      .attr('stroke-width', 2);

    const bisect = d3.bisector<LineChartDataPoint, Date>((d) => d.date).center;

    const overlay = svg
      .append('rect')
      .attr('x', MARGIN_LEFT)
      .attr('y', MARGIN_TOP)
      .attr('width', Math.max(0, width - MARGIN_LEFT - MARGIN_RIGHT))
      .attr('height', Math.max(0, height - MARGIN_TOP - MARGIN_BOTTOM))
      .attr('fill', 'transparent');

    overlay.on('pointerenter', () => hoverGroup.style('display', null));
    overlay.on('pointerleave', () => {
      hoverGroup.style('display', 'none');
      setHover(null);
    });
    overlay.on('pointermove', (event: PointerEvent) => {
      const [mx] = d3.pointer(event, svgEl);
      const dateAtCursor = x.invert(mx);
      const idx = bisect(data, dateAtCursor);
      const point = data[idx];
      if (!point) return;
      const px = x(point.date);
      const py = y(point.cumulative);
      hoverGroup.select<SVGLineElement>('.hover-rule').attr('x1', px).attr('x2', px);
      hoverGroup.select<SVGCircleElement>('.hover-dot').attr('cx', px).attr('cy', py);
      setHover({ x: px, y: py, point });
    });
  }, [data, dims, isDark, revenueColor, goalColor]);

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

  // Tooltip placement: keep inside the container by flipping above point
  // when too close to the top, and to the left when too close to the right.
  const tooltipOffsetX = 12;
  const tooltipOffsetY = 12;
  const tooltipWidthEstimate = 180;
  const flipLeft = hover ? hover.x + tooltipWidthEstimate + tooltipOffsetX > dims.width : false;
  const flipUp = hover ? hover.y < 80 : false;

  return (
    <Card className={className}>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>

          {/* Legend — colors mirror the SVG exactly so the eye maps them 1:1. */}
          <div
            role="list"
            aria-label="Chart legend"
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs"
          >
            <div role="listitem" className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: revenueColor }}
              />
              <span className="font-medium text-foreground">{seriesLabel}</span>
              <span className="text-muted-foreground">cumulative this period</span>
            </div>
            {hasGoalSeries && (
              <div role="listitem" className="flex items-center gap-2">
                <svg width="22" height="6" aria-hidden="true">
                  <line
                    x1="0"
                    y1="3"
                    x2="22"
                    y2="3"
                    stroke={goalColor}
                    strokeWidth="2"
                    strokeDasharray="6 5"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="font-medium text-foreground">Goal</span>
                <span className="text-muted-foreground">
                  pace to {formatLabel(annualGoal ?? 1_500_000)}/yr
                </span>
              </div>
            )}
          </div>
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
      </CardHeader>

      <CardContent>
        <div
          ref={containerRef}
          className="relative w-full"
          style={{ height: CHART_HEIGHT }}
        >
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : data.length > 0 && dims.width > 0 ? (
            <>
              <svg
                ref={svgRef}
                width={dims.width}
                height={dims.height}
                role="img"
                aria-label={`${seriesLabel} cumulative line chart with goal pace overlay`}
                style={{ display: 'block', font: '10px sans-serif' }}
              />
              {hover && (
                <div
                  className="pointer-events-none absolute z-10 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs shadow-xl"
                  style={{
                    left: flipLeft ? hover.x - tooltipWidthEstimate - tooltipOffsetX : hover.x + tooltipOffsetX,
                    top: flipUp ? hover.y + tooltipOffsetY : hover.y - tooltipOffsetY - 56,
                    minWidth: 160,
                  }}
                >
                  <div className="mb-1 font-medium text-foreground">
                    {format(hover.point.date, 'MMM d, yyyy')}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: revenueColor }}
                      />
                      {seriesLabel}
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatTooltipCurrency(hover.point.cumulative)}
                    </span>
                  </div>
                  {typeof hover.point.goal === 'number' && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span
                          aria-hidden="true"
                          className="inline-block h-[2px] w-3"
                          style={{ backgroundColor: goalColor }}
                        />
                        Goal
                      </span>
                      <span
                        className="font-mono font-medium tabular-nums"
                        style={{ color: goalColor }}
                      >
                        {formatTooltipCurrency(hover.point.goal)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
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
