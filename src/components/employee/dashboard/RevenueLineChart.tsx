import { useCallback, useEffect, useRef, useState } from 'react';
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
  className?: string;
}

const MARGIN_TOP = 30;
const MARGIN_RIGHT = 80;
const MARGIN_BOTTOM = 30;
const MARGIN_LEFT = 30;
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
  description = 'Cumulative monthly revenue',
  seriesLabel = 'Revenue',
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

    const lineColor = isDark ? '#e2e8f0' : '#0f172a';
    const axisColor = isDark ? '#94a3b8' : '#64748b';
    const haloColor = isDark ? '#0b1120' : '#ffffff';
    const textColor = isDark ? '#e2e8f0' : '#0f172a';

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const x = d3
      .scaleUtc()
      .domain([data[0].date, data[data.length - 1].date])
      .range([MARGIN_LEFT, width - MARGIN_RIGHT]);

    const yMax = d3.max(data, (d) => d.cumulative) ?? 0;
    const y = d3
      .scaleLinear()
      .domain([0, yMax === 0 ? 1 : yMax])
      .range([height - MARGIN_BOTTOM, MARGIN_TOP]);

    const xAxisGroup = svg
      .append('g')
      .attr('transform', `translate(0,${height - MARGIN_BOTTOM})`)
      .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0));
    xAxisGroup.selectAll('path, line').attr('stroke', axisColor);
    xAxisGroup.selectAll('text').attr('fill', axisColor);

    const series = [{ name: seriesLabel, points: data }];

    const serie = svg
      .append('g')
      .selectAll('g')
      .data(series)
      .join('g');

    serie
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 1.5)
      .attr(
        'd',
        (s) =>
          d3
            .line<LineChartDataPoint>()
            .x((d) => x(d.date))
            .y((d) => y(d.cumulative))(s.points)!,
      );

    const labels = serie
      .append('g')
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('text-anchor', 'middle')
      .selectAll('text')
      .data((s) => s.points.map((p) => ({ ...p, seriesName: s.name })))
      .join('text')
      .text((d) => formatLabel(d.cumulative))
      .attr('fill', textColor)
      .attr('dy', '0.35em')
      .attr('x', (d) => x(d.date))
      .attr('y', (d) => y(d.cumulative) - 12);

    labels
      .filter((_, i, nodes) => i === nodes.length - 1)
      .append('tspan')
      .attr('font-weight', 'bold')
      .text((d) => ` ${d.seriesName}`);

    labels
      .clone(true)
      .lower()
      .attr('fill', 'none')
      .attr('stroke', haloColor)
      .attr('stroke-width', 6);

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
      .attr('stroke', axisColor)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3');

    hoverGroup
      .append('circle')
      .attr('class', 'hover-dot')
      .attr('r', 4)
      .attr('fill', lineColor)
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
  }, [data, dims, isDark, seriesLabel]);

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
                    <span className="text-muted-foreground">{seriesLabel}</span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {formatTooltipCurrency(hover.point.cumulative)}
                    </span>
                  </div>
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
